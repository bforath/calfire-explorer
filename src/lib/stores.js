// Central store for all shared application state.
// Components read from these stores and dispatch updates to them —
// they never reach into sibling components directly.

import { writable, derived } from 'svelte/store';
import { matchesFilters, sortIncidents } from './utils.js';
import {
	DEFAULT_SORT_COLUMN,
	DEFAULT_SORT_DIRECTION,
	DEFAULT_DENSITY,
	DEFAULT_ROWS_PER_PAGE
} from './constants.js';

// ---------------------------------------------------------------------------
// Raw data — populated once on app load, never mutated after that
// ---------------------------------------------------------------------------

export const incidents = writable([]);

// Tracks the fetch lifecycle so the UI can show a spinner or error message
export const loadingState = writable({ status: 'idle', error: null });
// status is one of: 'idle' | 'loading' | 'success' | 'error'

// ---------------------------------------------------------------------------
// Filter state — each filter is independent, all stacked with AND logic
// ---------------------------------------------------------------------------

export const filters = writable({
	units: [],
	yearRange: [1950, new Date().getFullYear()],
	causes: [],
	acresRange: [0, Infinity],
	search: ''
});

// ---------------------------------------------------------------------------
// UI state — display preferences and navigation, separate from data concerns
// ---------------------------------------------------------------------------

export const uiState = writable({
	selectedIncident: null,
	density: DEFAULT_DENSITY,
	sortColumn: DEFAULT_SORT_COLUMN,
	sortDirection: DEFAULT_SORT_DIRECTION,
	currentPage: 1,
	rowsPerPage: DEFAULT_ROWS_PER_PAGE
});

// ---------------------------------------------------------------------------
// Derived stores — recomputed automatically whenever their sources change.
// These are the outputs of the data pipeline — components read these,
// not the raw incidents store directly.
// ---------------------------------------------------------------------------

// All incidents that pass the active filters
export const filteredIncidents = derived(
	[incidents, filters],
	([$incidents, $filters]) => {
		return $incidents.filter((incident) => matchesFilters(incident, $filters));
	}
);

// Filtered incidents sorted by the current column and direction
export const sortedIncidents = derived(
	[filteredIncidents, uiState],
	([$filteredIncidents, $uiState]) => {
		return sortIncidents($filteredIncidents, $uiState.sortColumn, $uiState.sortDirection);
	}
);

// The single page of rows the table actually renders
export const paginatedIncidents = derived(
	[sortedIncidents, uiState],
	([$sortedIncidents, $uiState]) => {
		const startIndex = ($uiState.currentPage - 1) * $uiState.rowsPerPage;
		return $sortedIncidents.slice(startIndex, startIndex + $uiState.rowsPerPage);
	}
);

// Summary statistics computed from the currently filtered set
export const summaryStats = derived(filteredIncidents, ($filteredIncidents) => {
	if ($filteredIncidents.length === 0) {
		return {
			count: 0,
			totalAcres: 0,
			unitsAffected: 0,
			peakYear: null,
			mostActiveUnit: null
		};
	}

	const totalAcres = $filteredIncidents.reduce(
		(runningTotal, incident) => runningTotal + (incident.acres ?? 0),
		0
	);

	const unitsAffected = new Set($filteredIncidents.map((incident) => incident.unit)).size;

	// Year with the most incidents
	const incidentCountByYear = $filteredIncidents.reduce((accumulator, incident) => {
		if (incident.year) accumulator[incident.year] = (accumulator[incident.year] ?? 0) + 1;
		return accumulator;
	}, {});
	const peakYear =
		Object.keys(incidentCountByYear).sort(
			(yearA, yearB) => incidentCountByYear[yearB] - incidentCountByYear[yearA]
		)[0] ?? null;

	// Unit with the most incidents
	const incidentCountByUnit = $filteredIncidents.reduce((accumulator, incident) => {
		if (incident.unit) accumulator[incident.unit] = (accumulator[incident.unit] ?? 0) + 1;
		return accumulator;
	}, {});
	const mostActiveUnit =
		Object.keys(incidentCountByUnit).sort(
			(unitA, unitB) => incidentCountByUnit[unitB] - incidentCountByUnit[unitA]
		)[0] ?? null;

	return { count: $filteredIncidents.length, totalAcres, unitsAffected, peakYear, mostActiveUnit };
});

// ---------------------------------------------------------------------------
// Side effect — resets the current page whenever filters change so you don't
// land on page 5 of a result set that now only has 2 pages
// ---------------------------------------------------------------------------

filters.subscribe(() => {
	uiState.update((currentState) => ({ ...currentState, currentPage: 1 }));
});
