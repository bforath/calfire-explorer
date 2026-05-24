// Fetches all CAL FIRE incident records and writes a normalized snapshot to
// static/incidents.json. Run before `npm run build` so the app loads the
// local file instead of hitting the ArcGIS API at runtime.
//
// Usage:  node scripts/fetch-data.js
// CI:     called automatically by the GitHub Actions deploy workflow

import { writeFileSync } from 'fs';
import { ARCGIS_SERVICE_URL, API_PAGE_SIZE, CAUSE_CODES } from '../src/lib/constants.js';

async function fetchPage(offset) {
	const url = new URL(ARCGIS_SERVICE_URL);
	url.searchParams.set('where', '1=1');
	url.searchParams.set('outFields', '*');
	url.searchParams.set('returnCentroid', 'true');
	url.searchParams.set('outSR', '4326');
	url.searchParams.set('resultRecordCount', API_PAGE_SIZE);
	url.searchParams.set('resultOffset', offset);
	url.searchParams.set('f', 'json');

	const response = await fetch(url);
	if (!response.ok) throw new Error(`API error: ${response.status}`);
	const json = await response.json();
	if (json.error) throw new Error(`API error: ${json.error.message}`);
	return json.features ?? [];
}

function timestampToDateString(timestamp) {
	if (timestamp == null) return null;
	return new Date(timestamp).toISOString().split('T')[0];
}

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
		name: attributes.FIRE_NAME ? attributes.FIRE_NAME.trim() : 'Unknown',
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

async function main() {
	console.log('Fetching CAL FIRE incident data...');

	const firstPageFeatures = await fetchPage(0);
	const allFeatures = [...firstPageFeatures];
	console.log(`  Page 1: ${firstPageFeatures.length} records`);

	if (firstPageFeatures.length === API_PAGE_SIZE) {
		const countUrl = new URL(ARCGIS_SERVICE_URL);
		countUrl.searchParams.set('where', '1=1');
		countUrl.searchParams.set('returnCountOnly', 'true');
		countUrl.searchParams.set('f', 'json');

		const countResponse = await fetch(countUrl);
		const countData = await countResponse.json();
		const totalCount = countData.count ?? 0;
		console.log(`  Total records: ${totalCount}`);

		const remainingOffsets = [];
		for (let offset = API_PAGE_SIZE; offset < totalCount; offset += API_PAGE_SIZE) {
			remainingOffsets.push(offset);
		}

		const remainingPages = await Promise.all(remainingOffsets.map(fetchPage));
		for (const pageFeatures of remainingPages) {
			allFeatures.push(...pageFeatures);
		}
	}

	const incidents = allFeatures.map(normalizeIncident);
	writeFileSync('static/incidents.json', JSON.stringify(incidents));
	console.log(`  Done — ${incidents.length} incidents written to static/incidents.json`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
