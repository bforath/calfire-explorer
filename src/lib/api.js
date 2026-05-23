// Fetches all CAL FIRE incident records from the California Open Data Portal.
// All records are loaded once on startup — no further API calls are made.

import { API_BASE, RESOURCE_ID, API_PAGE_SIZE } from './constants.js';

/**
 * Fetches one page of results from the CKAN API.
 * CKAN returns: { result: { records: [...], total: N } }
 */
async function fetchPage(offset) {
	const url = new URL(API_BASE);
	url.searchParams.set('resource_id', RESOURCE_ID);
	url.searchParams.set('limit', API_PAGE_SIZE);
	url.searchParams.set('offset', offset);

	const response = await fetch(url);
	if (!response.ok) throw new Error(`API error: ${response.status}`);

	const json = await response.json();
	return json.result;
}

/**
 * Normalizes a raw API record into a clean, predictable shape.
 * Raw field names from CKAN are long and inconsistent — we clean them here
 * so every component works with the same structure.
 */
function normalizeIncident(raw) {
	const startDate = raw.incident_dateonly_created ?? null;
	const endDate = raw.incident_dateonly_extinguished ?? null;

	// Calculate duration in days when both dates are present
	let durationDays = null;
	if (startDate && endDate) {
		const ms = new Date(endDate) - new Date(startDate);
		durationDays = Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
	}

	return {
		id: raw._id,
		name: raw.incident_name ?? 'Unknown',
		county: raw.incident_county ?? 'Unknown',
		year: startDate ? new Date(startDate).getFullYear() : null,
		cause: raw.incident_cause ?? 'Unknown',
		acres: raw.incident_acres_burned ? Number(raw.incident_acres_burned) : null,
		containment: raw.incident_containment ? Number(raw.incident_containment) : null,
		startDate,
		endDate,
		durationDays,
		lat: raw.incident_latitude ? Number(raw.incident_latitude) : null,
		lng: raw.incident_longitude ? Number(raw.incident_longitude) : null,
		url: raw.incident_url ?? null,
		isActive: raw.incident_is_active === 'true' || raw.incident_is_active === true
	};
}

/**
 * Fetches every incident record from the API, paginating until complete.
 * Returns a normalized array ready to store and filter client-side.
 */
export async function fetchAllIncidents() {
	// First request tells us the total record count
	const firstPage = await fetchPage(0);
	const total = firstPage.total;
	const records = [...firstPage.records];

	// Fetch remaining pages in parallel for speed
	if (total > API_PAGE_SIZE) {
		const offsets = [];
		for (let offset = API_PAGE_SIZE; offset < total; offset += API_PAGE_SIZE) {
			offsets.push(offset);
		}

		const remainingPages = await Promise.all(offsets.map(fetchPage));
		for (const page of remainingPages) {
			records.push(...page.records);
		}
	}

	return records.map(normalizeIncident);
}
