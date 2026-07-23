// Fetches all CAL FIRE incident records.
// In production, reads from a pre-built static snapshot (static/incidents.json)
// served from the CDN — much faster than hitting the ArcGIS API at runtime.
// Falls back to the live ArcGIS API for local development if the snapshot isn't present.

import { base } from '$app/paths';
import { ARCGIS_SERVICE_URL, API_PAGE_SIZE, CAUSE_CODES } from './constants.js';

/**
 * Fetches one page of features from the ArcGIS FeatureServer.
 * ArcGIS uses resultOffset/resultRecordCount for pagination.
 * returnCentroid=true adds a centroid property to each feature with lat/lng.
 */
async function fetchPage(offset) {
	const url = new URL(ARCGIS_SERVICE_URL);
	url.searchParams.set('where', '1=1');
	url.searchParams.set('outFields', '*');
	url.searchParams.set('returnCentroid', 'true');
	url.searchParams.set('outSR', '4326'); // WGS84 — standard lat/lng coordinates
	url.searchParams.set('resultRecordCount', API_PAGE_SIZE);
	url.searchParams.set('resultOffset', offset);
	url.searchParams.set('f', 'json');

	const response = await fetch(url);
	if (!response.ok) throw new Error(`API error: ${response.status}`);

	const json = await response.json();
	if (json.error) throw new Error(`API error: ${json.error.message}`);

	return json.features ?? [];
}

/**
 * Converts an ArcGIS timestamp (milliseconds since epoch) to an ISO date string.
 * Returns null if the value is missing or invalid.
 */
function timestampToDateString(timestamp) {
	if (timestamp == null) return null;
	return new Date(timestamp).toISOString().split('T')[0];
}

/**
 * Normalizes a raw ArcGIS feature into a clean, predictable shape.
 * Raw ArcGIS field names are terse and uppercase — we clean them here
 * so every component works with the same readable structure.
 */
function normalizeIncident(feature) {
	const attributes = feature.attributes;
	const centroid = feature.centroid;

	const startDate = timestampToDateString(attributes.ALARM_DATE);
	const endDate = timestampToDateString(attributes.CONT_DATE);

	let durationDays = null;
	if (startDate && endDate) {
		const milliseconds = new Date(endDate) - new Date(startDate);
		durationDays = Math.max(0, Math.round(milliseconds / (1000 * 60 * 60 * 24)));
	}

	return {
		id: attributes.OBJECTID,
		name: attributes.FIRE_NAME
			? attributes.FIRE_NAME.trim()
			: 'Unknown',
		unit: attributes.UNIT_ID ?? 'Unknown',
		agency: attributes.AGENCY ?? null,
		year: attributes.YEAR_ ?? null,
		cause: CAUSE_CODES[attributes.CAUSE] ?? 'Unknown',
		acres: attributes.GIS_ACRES != null ? Math.round(attributes.GIS_ACRES) : null,
		startDate,
		endDate,
		durationDays,
		lat: centroid?.y ?? null,
		lng: centroid?.x ?? null
	};
}

const CACHE_NAME = 'calfire-incidents-v1';
const CACHE_KEY = 'incidents-data';

// Shared promise deduplicates concurrent callers within a single session.
let fetchPromise = null;

/**
 * Loads every incident record.
 * On first load: fetches from the static snapshot or live ArcGIS API, then
 * stores the result in the Cache API so subsequent page loads return instantly.
 * On repeat loads: returns from the Cache API without hitting the network.
 */
export async function fetchAllIncidents() {
	if (!fetchPromise) {
		fetchPromise = (async () => {
			// Check Cache API first — survives page refreshes
			try {
				const cache = await caches.open(CACHE_NAME);
				const cached = await cache.match(CACHE_KEY);
				if (cached) return cached.json();
			} catch {
				// Cache API unavailable (some private-browsing modes) — proceed to fetch
			}

			// Fetch from static snapshot or live ArcGIS API
			let data;
			try {
				const response = await fetch(`${base}/incidents.json`);
				if (response.ok) data = await response.json();
			} catch {
				// snapshot not present — fall through to live API
			}
			if (!data) data = await fetchFromArcGIS();

			// Persist for next load
			try {
				const cache = await caches.open(CACHE_NAME);
				await cache.put(CACHE_KEY, new Response(JSON.stringify(data), {
					headers: { 'Content-Type': 'application/json' }
				}));
			} catch {
				// Storage quota exceeded or unavailable — not critical, data still returned
			}

			return data;
		})();
	}
	return fetchPromise;
}

async function fetchFromArcGIS() {
	const firstPageFeatures = await fetchPage(0);
	const allFeatures = [...firstPageFeatures];

	if (firstPageFeatures.length === API_PAGE_SIZE) {
		const countUrl = new URL(ARCGIS_SERVICE_URL);
		countUrl.searchParams.set('where', '1=1');
		countUrl.searchParams.set('returnCountOnly', 'true');
		countUrl.searchParams.set('f', 'json');

		const countResponse = await fetch(countUrl);
		const countData = await countResponse.json();
		const totalCount = countData.count ?? 0;

		const remainingOffsets = [];
		for (let offset = API_PAGE_SIZE; offset < totalCount; offset += API_PAGE_SIZE) {
			remainingOffsets.push(offset);
		}

		const remainingPages = await Promise.all(remainingOffsets.map(fetchPage));
		for (const pageFeatures of remainingPages) {
			allFeatures.push(...pageFeatures);
		}
	}

	return allFeatures.map(normalizeIncident);
}
