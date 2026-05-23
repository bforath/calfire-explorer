// Fetches all CAL FIRE incident records from the ArcGIS FeatureServer.
// The ArcGIS endpoint is used (rather than the CKAN API) because it returns
// centroid coordinates alongside the incident attributes, which we need for the map.
// All records are loaded once on startup — no further API calls are made.

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

/**
 * Fetches every incident record from the ArcGIS FeatureServer, paginating until complete.
 * Pages are fetched in parallel after the first request reveals the total count.
 * Returns a normalized array ready to store and filter client-side.
 */
export async function fetchAllIncidents() {
	// First page also tells us if there are more pages to fetch
	const firstPageFeatures = await fetchPage(0);
	const allFeatures = [...firstPageFeatures];

	// If we got a full page, there are likely more — keep fetching in parallel
	if (firstPageFeatures.length === API_PAGE_SIZE) {
		// Get the total count so we know exactly how many pages to request
		const countUrl = new URL(ARCGIS_SERVICE_URL);
		countUrl.searchParams.set('where', '1=1');
		countUrl.searchParams.set('returnCountOnly', 'true');
		countUrl.searchParams.set('f', 'json');

		const countResponse = await fetch(countUrl);
		const countData = await countResponse.json();
		const totalCount = countData.count ?? 0;

		// Build all remaining page offsets and fetch them simultaneously
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
