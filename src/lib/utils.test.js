import { describe, it, expect } from 'vitest';
import { formatAcres, formatDate, formatPercent, matchesFilters, sortIncidents } from './utils.js';

// A minimal incident fixture reused across tests
const base = {
	id: 1,
	name: 'Camp Fire',
	county: 'Butte',
	year: 2018,
	cause: 'Equipment',
	acres: 153336,
	containment: 100,
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

describe('formatPercent', () => {
	it('formats a number as percent', () => expect(formatPercent(85)).toBe('85%'));
	it('rounds decimals', () => expect(formatPercent(84.6)).toBe('85%'));
	it('returns dash for null', () => expect(formatPercent(null)).toBe('—'));
});

describe('matchesFilters', () => {
	const noFilters = {
		counties: [],
		yearRange: [1900, 2100],
		causes: [],
		acresRange: [0, Infinity],
		containmentRange: [0, 100],
		search: ''
	};

	it('passes when no filters are active', () => {
		expect(matchesFilters(base, noFilters)).toBe(true);
	});

	it('filters by county', () => {
		const filters = { ...noFilters, counties: ['Butte'] };
		expect(matchesFilters(base, filters)).toBe(true);
		expect(matchesFilters({ ...base, county: 'Napa' }, filters)).toBe(false);
	});

	it('filters by year range', () => {
		const filters = { ...noFilters, yearRange: [2015, 2020] };
		expect(matchesFilters(base, filters)).toBe(true);
		expect(matchesFilters({ ...base, year: 2010 }, filters)).toBe(false);
	});

	it('filters by search string', () => {
		const filters = { ...noFilters, search: 'camp' };
		expect(matchesFilters(base, filters)).toBe(true);
		expect(matchesFilters({ ...base, name: 'Dixie Fire' }, filters)).toBe(false);
	});
});

describe('sortIncidents', () => {
	const incidents = [
		{ ...base, name: 'Camp Fire', acres: 153336, year: 2018 },
		{ ...base, name: 'Dixie Fire', acres: 963000, year: 2021 },
		{ ...base, name: 'Mendocino Complex', acres: 459000, year: 2018 }
	];

	it('sorts by acres ascending', () => {
		const sorted = sortIncidents(incidents, 'acres', 'asc');
		expect(sorted.map((i) => i.name)).toEqual(['Camp Fire', 'Mendocino Complex', 'Dixie Fire']);
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
