// Pure utility functions for formatting, sorting, and filtering.
// No Svelte dependencies — these can be tested without a DOM.

/**
 * Returns a display-ready string for a given column key and incident.
 * Centralizes all formatting logic so TableRow doesn't need to know which
 * columns need special formatting.
 */
export function formatColumnValue(columnKey, incident) {
	switch (columnKey) {
		case 'acres':        return formatAcres(incident.acres);
		case 'durationDays': return formatDuration(incident.durationDays);
		case 'startDate':    return formatDate(incident.startDate);
		default:             return incident[columnKey] ?? '—';
	}
}

/**
 * Formats a large number as a compact human-readable string.
 * 1234567 becomes "1.2M", 45000 becomes "45K"
 */
export function formatAcres(acres) {
	if (acres == null) return '—';
	if (acres >= 1_000_000) return `${(acres / 1_000_000).toFixed(1)}M`;
	if (acres >= 1_000) return `${(acres / 1_000).toFixed(0)}K`;
	return acres.toLocaleString();
}

/**
 * Formats an ISO date string as a short human-readable date.
 * "2018-11-08" becomes "Nov 8, 2018"
 */
export function formatDate(dateString) {
	if (!dateString) return '—';
	return new Date(dateString).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'UTC' // prevents off-by-one errors from local timezone shifts
	});
}

/**
 * Formats a duration in days as a readable string.
 * 1 becomes "1 day", 45 becomes "45 days", null becomes "—"
 */
export function formatDuration(days) {
	if (days == null) return '—';
	return days === 1 ? '1 day' : `${days} days`;
}

/**
 * Returns true if the incident matches all active filters.
 * Filters stack with AND logic — every active filter must pass.
 */
export function matchesFilters(incident, filters) {
	const { units, yearRange, causes, acresRange, search } = filters;

	if (units.length > 0 && !units.includes(incident.unit)) return false;

	if (incident.year !== null) {
		if (incident.year < yearRange[0] || incident.year > yearRange[1]) return false;
	}

	if (causes.length > 0 && !causes.includes(incident.cause)) return false;

	if (incident.acres !== null) {
		if (incident.acres < acresRange[0]) return false;
		if (acresRange[1] !== Infinity && incident.acres > acresRange[1]) return false;
	}

	if (search.trim()) {
		const query = search.toLowerCase();
		const searchableText = [
			incident.name,
			incident.unit,
			incident.cause,
			String(incident.year ?? '')
		]
			.join(' ')
			.toLowerCase();
		if (!searchableText.includes(query)) return false;
	}

	return true;
}

/**
 * Sorts an array of incidents by a given column and direction.
 * Returns a new array — does not mutate the input.
 */
export function sortIncidents(incidents, column, direction) {
	const sortMultiplier = direction === 'asc' ? 1 : -1;

	return [...incidents].sort((incidentA, incidentB) => {
		const valueA = incidentA[column] ?? '';
		const valueB = incidentB[column] ?? '';

		if (typeof valueA === 'number' && typeof valueB === 'number') {
			return (valueA - valueB) * sortMultiplier;
		}

		return String(valueA).localeCompare(String(valueB)) * sortMultiplier;
	});
}

/**
 * Returns unique sorted values for a given field across all incidents.
 * Used to populate filter dropdown options.
 */
export function uniqueValues(incidents, field) {
	return [...new Set(incidents.map((incident) => incident[field]).filter(Boolean))].sort();
}
