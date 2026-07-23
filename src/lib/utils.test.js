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

import {
	computeAcresTrend,
	computeProjectedCost
} from './analytics.js';

describe('computeAcresTrend', () => {
	it('marks all historical points with projected: false', () => {
		const incidentData = [
			{ year: 2000, acres: 1000 },
			{ year: 2001, acres: 2000 },
			{ year: 2002, acres: 3000 }
		];
		const result = computeAcresTrend(incidentData, 0);
		expect(result.every((point) => point.projected === false)).toBe(true);
	});

	it('appends the correct number of projected points with projected: true', () => {
		const incidentData = [
			{ year: 2000, acres: 1000 },
			{ year: 2001, acres: 2000 }
		];
		const result = computeAcresTrend(incidentData, 3);
		const projectedPoints = result.filter((point) => point.projected === true);
		expect(projectedPoints.length).toBe(3);
	});

	it('projected years start immediately after the last historical year', () => {
		const incidentData = [
			{ year: 2000, acres: 1000 },
			{ year: 2001, acres: 2000 },
			{ year: 2002, acres: 3000 }
		];
		const result = computeAcresTrend(incidentData, 5);
		const projectedYears = result.filter((point) => point.projected).map((point) => point.year);
		expect(projectedYears[0]).toBe(2003);
		expect(projectedYears.every((year) => year > 2002)).toBe(true);
	});

	it('projects a higher value than the last historical point when data is consistently increasing', () => {
		const incidentData = [
			{ year: 2000, acres: 1000 },
			{ year: 2001, acres: 2000 },
			{ year: 2002, acres: 3000 },
			{ year: 2003, acres: 4000 }
		];
		const result = computeAcresTrend(incidentData, 1);
		const historicalPoints = result.filter((point) => !point.projected);
		const projectedPoints = result.filter((point) => point.projected);
		expect(projectedPoints[0].acres).toBeGreaterThan(historicalPoints[historicalPoints.length - 1].acres);
	});

	it('skips incidents with null year or null acres', () => {
		const incidentData = [
			{ year: null, acres: 1000 },
			{ year: 2000, acres: null },
			{ year: 2001, acres: 2000 }
		];
		const result = computeAcresTrend(incidentData, 0);
		expect(result.length).toBe(1);
		expect(result[0].year).toBe(2001);
	});

	it('skips incidents with year before 1950', () => {
		const incidentData = [
			{ year: 1930, acres: 5000 },
			{ year: 2000, acres: 1000 }
		];
		const result = computeAcresTrend(incidentData, 0);
		expect(result.length).toBe(1);
		expect(result[0].year).toBe(2000);
	});

	it('returns empty array for empty input', () => {
		expect(computeAcresTrend([], 5)).toEqual([]);
	});

	it('sums acres across multiple incidents in the same year', () => {
		const incidentData = [
			{ year: 2000, acres: 1000 },
			{ year: 2000, acres: 500 },
			{ year: 2001, acres: 2000 }
		];
		const result = computeAcresTrend(incidentData, 0);
		expect(result[0].acres).toBe(1500);
	});
});

describe('computeProjectedCost', () => {
	it('multiplies acres by the cost per acre', () => {
		const trend = [{ year: 2000, acres: 1000, projected: false }];
		const result = computeProjectedCost(trend, 2500);
		expect(result[0].cost).toBe(2_500_000);
	});

	it('preserves the projected flag from input', () => {
		const trend = [
			{ year: 2000, acres: 1000, projected: false },
			{ year: 2001, acres: 1200, projected: true }
		];
		const result = computeProjectedCost(trend, 2500);
		expect(result[0].projected).toBe(false);
		expect(result[1].projected).toBe(true);
	});

	it('uses a default cost per acre of 2500 when not specified', () => {
		const trend = [{ year: 2000, acres: 100, projected: false }];
		const result = computeProjectedCost(trend);
		expect(result[0].cost).toBe(250_000);
	});

	it('preserves the year on each output point', () => {
		const trend = [{ year: 2023, acres: 500, projected: false }];
		const result = computeProjectedCost(trend, 2500);
		expect(result[0].year).toBe(2023);
	});

	it('returns empty array for empty input', () => {
		expect(computeProjectedCost([])).toEqual([]);
	});
});
