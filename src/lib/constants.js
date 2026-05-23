// API
export const API_BASE = 'https://data.ca.gov/api/3/action/datastore_search';
export const RESOURCE_ID = 'e64e7ae0-50c0-4e47-8bf7-1f2e70e1d357';
export const API_PAGE_SIZE = 1000; // records per request — CKAN max is 32000 but 1000 is safer

// Table
export const ROWS_PER_PAGE_OPTIONS = [25, 50, 100];
export const DEFAULT_ROWS_PER_PAGE = 25;
export const DEFAULT_SORT_COLUMN = 'year';
export const DEFAULT_SORT_DIRECTION = 'desc';

// Column definitions — key maps to the field name on a normalized incident object
export const TABLE_COLUMNS = [
	{ key: 'name',        label: 'Incident Name', sortable: true, frozen: true  },
	{ key: 'county',      label: 'County',        sortable: true, frozen: false },
	{ key: 'year',        label: 'Year',          sortable: true, frozen: false },
	{ key: 'cause',       label: 'Cause',         sortable: true, frozen: false },
	{ key: 'acres',       label: 'Acres',         sortable: true, frozen: false },
	{ key: 'containment', label: 'Containment',   sortable: true, frozen: false },
	{ key: 'startDate',   label: 'Start Date',    sortable: true, frozen: false }
];

// Density
export const DENSITY_OPTIONS = ['compact', 'comfortable', 'spacious'];
export const DEFAULT_DENSITY = 'comfortable';

// Map — dot color thresholds by acres burned
export const ACRES_SMALL = 1_000;
export const ACRES_MEDIUM = 10_000;
export const ACRES_LARGE = 100_000;
