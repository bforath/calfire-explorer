// API — ArcGIS FeatureServer for California Historic Fire Perimeters (CAL FIRE / CALFIRE public data)
// This is the same underlying data as the California Open Data Portal CKAN dataset,
// but the ArcGIS endpoint also returns centroid coordinates which we need for the map.
export const ARCGIS_SERVICE_URL =
	'https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/California_Historic_Fire_Perimeters/FeatureServer/0/query';
export const API_PAGE_SIZE = 2000; // ArcGIS maxRecordCount for this service

// Table
export const ROWS_PER_PAGE_OPTIONS = [25, 50, 100];
export const DEFAULT_ROWS_PER_PAGE = 25;
export const DEFAULT_SORT_COLUMN = 'year';
export const DEFAULT_SORT_DIRECTION = 'desc';

// Column definitions — key maps to the field name on a normalized incident object
export const TABLE_COLUMNS = [
	{ key: 'name',         label: 'Incident Name', sortable: true,  frozen: true  },
	{ key: 'unit',         label: 'Unit',          sortable: true,  frozen: false },
	{ key: 'year',         label: 'Year',          sortable: true,  frozen: false },
	{ key: 'cause',        label: 'Cause',         sortable: true,  frozen: false },
	{ key: 'acres',        label: 'Acres',         sortable: true,  frozen: false },
	{ key: 'durationDays', label: 'Duration',      sortable: true,  frozen: false },
	{ key: 'startDate',    label: 'Start Date',    sortable: true,  frozen: false }
];

// Density
export const DENSITY_OPTIONS = ['compact', 'comfortable', 'spacious'];
export const DEFAULT_DENSITY = 'comfortable';

// Map — dot color thresholds by acres burned
export const ACRES_SMALL  =   1_000;
export const ACRES_MEDIUM =  10_000;
export const ACRES_LARGE  = 100_000;

// CAL FIRE cause codes — numeric codes used in the source data mapped to readable names
// Source: https://www.fire.ca.gov/media/5614/firestat.pdf
export const CAUSE_CODES = {
	1:  'Lightning',
	2:  'Equipment Use',
	3:  'Smoking',
	4:  'Campfire',
	5:  'Debris Burning',
	6:  'Railroad',
	7:  'Arson',
	8:  'Playing with Fire',
	9:  'Miscellaneous',
	10: 'Vehicle',
	11: 'Power Line',
	12: 'Firefighter Training',
	13: 'Non-Firefighter Training',
	14: 'Unknown',
	15: 'Structure',
	16: 'Aircraft',
	17: 'Escaped Prescribed Burn',
	18: 'Illegal Alien Campfire',
	19: 'Fire Suppression Activity'
};
