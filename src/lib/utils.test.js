import { describe, it, expect } from 'vitest';
import { formatAcres, formatDate, formatDuration, matchesFilters, sortIncidents } from './utils.js';

// A minimal incident fixture reused across tests
const baseIncident = {
	id: 1,
	name: 'Camp Fire',
	unit: 'BTU',
	year: 2018,
	cause: 'Equipment Use',
	acres: 153336,
	durationDays: 17,
	startDate: '2018-11-08',
	endDate: '2018-11-25'
};

describe('formatAcres', () => {
	it('formats millions', () => expect(formatAcres(1_234_567)).toBe('1.2M'));
	it('formats thousands', () => expect(formatAcres(45_000)).toBe('45K'));
	it('formats small numbers as-is', () => expect(formatAcres(500)).toBe('500'));
	it('returns dash for null', () => expect(formatAcres(null)).toBe('—'));
});

describe('formatDate', () => {
	it('formats an ISO date string', () => expect(formatDate('2018-11-08')).toBe('Nov 8, 2018'));
	it('returns dash for null', () => expect(formatDate(null)).toBe('—'));
});

describe('formatDuration', () => {
	it('formats a single day', () => expect(formatDuration(1)).toBe('1 day'));
	it('formats multiple days', () => expect(formatDuration(45)).toBe('45 days'));
	it('returns dash for null', () => expect(formatDuration(null)).toBe('—'));
});

describe('matchesFilters', () => {
	const noFilters = {
		units: [],
		yearRange: [1900, 2100],
		causes: [],
		acresRange: [0, Infinity],
		search: ''
	};

	it('passes when no filters are active', () => {
		expect(matchesFilters(baseIncident, noFilters)).toBe(true);
	});

	it('filters by unit', () => {
		const filters = { ...noFilters, units: ['BTU'] };
		expect(matchesFilters(baseIncident, filters)).toBe(true);
		expect(matchesFilters({ ...baseIncident, unit: 'LPF' }, filters)).toBe(false);
	});

	it('filters by year range', () => {
		const filters = { ...noFilters, yearRange: [2015, 2020] };
		expect(matchesFilters(baseIncident, filters)).toBe(true);
		expect(matchesFilters({ ...baseIncident, year: 2010 }, filters)).toBe(false);
	});

	it('filters by search string', () => {
		const filters = { ...noFilters, search: 'camp' };
		expect(matchesFilters(baseIncident, filters)).toBe(true);
		expect(matchesFilters({ ...baseIncident, name: 'Dixie Fire' }, filters)).toBe(false);
	});
});

describe('sortIncidents', () => {
	const incidents = [
		{ ...baseIncident, name: 'Camp Fire',          acres: 153336,  year: 2018 },
		{ ...baseIncident, name: 'Dixie Fire',          acres: 963000,  year: 2021 },
		{ ...baseIncident, name: 'Mendocino Complex',   acres: 459000,  year: 2018 }
	];

	it('sorts by acres ascending', () => {
		const sorted = sortIncidents(incidents, 'acres', 'asc');
		expect(sorted.map((incident) => incident.name)).toEqual([
			'Camp Fire',
			'Mendocino Complex',
			'Dixie Fire'
		]);
	});

	it('sorts by name descending', () => {
		const sorted = sortIncidents(incidents, 'name', 'desc');
		expect(sorted[0].name).toBe('Mendocino Complex');
	});

	it('does not mutate the original array', () => {
		const original = [...incidents];
		sortIncidents(incidents, 'acres', 'asc');
		expect(incidents).toEqual(original);
	});
});
