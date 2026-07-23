# Methodology Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/methodology` page that tells the full story from raw ArcGIS API data to cost projections — covering the ETL pipeline, field mapping, data quality, and a 10-year linear regression projection of fire suppression cost.

**Architecture:** New SvelteKit route at `src/routes/methodology/+page.svelte` reads from the existing `incidents` Svelte store and triggers a data fetch if the store is empty (direct page load). Two new pure analytics functions are added to `src/lib/analytics.js`. A "Methodology" link is added to the main page header.

**Tech Stack:** SvelteKit (Svelte 5 runes), Chart.js (dynamic import, already a dependency), Tailwind CSS, Vitest

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/analytics.js` | Add `computeAcresTrend` and `computeProjectedCost` |
| Modify | `src/lib/utils.test.js` | Unit tests for both new analytics functions |
| Modify | `src/routes/+page.svelte` | Add "Methodology" link to header |
| Create | `src/routes/methodology/+page.svelte` | Full methodology page — pipeline, field mapping, data quality, charts |

---

## Task 1: Create feature branch

**Files:** none (git only)

- [ ] **Step 1: Create and switch to feature branch**

```bash
git checkout -b feature/methodology-page
```

Expected: `Switched to a new branch 'feature/methodology-page'`

---

## Task 2: Add `computeAcresTrend` and `computeProjectedCost` to analytics.js (TDD)

**Files:**
- Modify: `src/lib/utils.test.js`
- Modify: `src/lib/analytics.js`

- [ ] **Step 1: Write failing tests**

Add the following block at the bottom of `src/lib/utils.test.js` (after the existing `sortIncidents` describe block):

```javascript
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -- --run
```

Expected: tests fail with `computeAcresTrend is not a function` (or similar). The existing 16 tests still pass.

- [ ] **Step 3: Implement `computeAcresTrend` and `computeProjectedCost` in analytics.js**

Append both functions to the end of `src/lib/analytics.js`:

```javascript
/**
 * Groups total acres burned by year (1950–present), fits a linear regression
 * to the year-vs-acres series, and extends it projectionYears into the future.
 *
 * Returns a flat array of { year, acres, projected } objects sorted by year.
 * Historical points carry projected: false; forecast points carry projected: true.
 * Projected acres are clamped to zero (regression can go negative in dry years).
 */
export function computeAcresTrend(incidents, projectionYears = 10) {
	const acresByYear = {};

	for (const incident of incidents) {
		if (incident.year == null || incident.acres == null) continue;
		if (incident.year < 1950) continue;
		acresByYear[incident.year] = (acresByYear[incident.year] ?? 0) + incident.acres;
	}

	const historical = Object.entries(acresByYear)
		.map(([year, acres]) => ({ year: Number(year), acres, projected: false }))
		.sort((pointA, pointB) => pointA.year - pointB.year);

	if (historical.length === 0) return [];

	// Ordinary least squares linear regression
	const pointCount = historical.length;
	const sumX = historical.reduce((total, point) => total + point.year, 0);
	const sumY = historical.reduce((total, point) => total + point.acres, 0);
	const sumXY = historical.reduce((total, point) => total + point.year * point.acres, 0);
	const sumX2 = historical.reduce((total, point) => total + point.year * point.year, 0);

	const slope = (pointCount * sumXY - sumX * sumY) / (pointCount * sumX2 - sumX * sumX);
	const intercept = (sumY - slope * sumX) / pointCount;

	const lastYear = historical[historical.length - 1].year;
	const projected = [];
	for (let yearOffset = 1; yearOffset <= projectionYears; yearOffset++) {
		const year = lastYear + yearOffset;
		const acres = Math.max(0, Math.round(slope * year + intercept));
		projected.push({ year, acres, projected: true });
	}

	return [...historical, ...projected];
}

/**
 * Converts an acreage trend (output of computeAcresTrend) into estimated
 * suppression cost by multiplying each year's acres by costPerAcre.
 *
 * Returns { year, cost, projected } objects — same shape and ordering as input.
 * The projected flag is preserved from the input.
 */
export function computeProjectedCost(acresTrend, costPerAcre = 2500) {
	return acresTrend.map(({ year, acres, projected }) => ({
		year,
		cost: acres * costPerAcre,
		projected
	}));
}
```

- [ ] **Step 4: Run tests to confirm they all pass**

```bash
npm run test -- --run
```

Expected output (all tests pass):
```
Test Files  1 passed (1)
      Tests  27 passed (27)
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics.js src/lib/utils.test.js
git commit -m "Add computeAcresTrend and computeProjectedCost analytics functions"
```

---

## Task 3: Add Methodology link to main page header

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Add the link before the attribution span**

In `src/routes/+page.svelte`, find this line (around line 80):

```svelte
			<span class="hidden text-xs text-gray-400 sm:inline">Data: CAL FIRE · California Historic Fire Perimeters</span>
```

Replace it with:

```svelte
			<a
				href="/methodology"
				class="hidden rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 sm:flex sm:px-3 sm:text-sm"
			>
				Methodology
			</a>
			<span class="hidden text-xs text-gray-400 sm:inline">Data: CAL FIRE · California Historic Fire Perimeters</span>
```

- [ ] **Step 2: Start the dev server and verify the link appears**

```bash
npm run dev
```

Open `http://localhost:5173`. You should see a "Methodology" button in the header, right of the Search button. Clicking it navigates to `/methodology` (which currently returns a 404 — that's expected until Task 4).

- [ ] **Step 3: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "Add Methodology nav link to main page header"
```

---

## Task 4: Create the methodology page

**Files:**
- Create: `src/routes/methodology/+page.svelte`

- [ ] **Step 1: Create the file**

Create `src/routes/methodology/+page.svelte` with the full contents below:

```svelte
<!-- Methodology page — data pipeline, field mapping, data quality, and cost projections. -->

<script>
	import { onMount } from 'svelte';
	import { incidents, loadingState } from '$lib/stores.js';
	import { fetchAllIncidents } from '$lib/api.js';
	import { computeAcresTrend, computeProjectedCost } from '$lib/analytics.js';

	const COST_PER_ACRE = 2500;

	const FIELD_MAPPINGS = [
		{ raw: 'OBJECTID',   normalized: 'id',           type: 'number', transformation: 'direct' },
		{ raw: 'FIRE_NAME',  normalized: 'name',         type: 'string', transformation: 'trimmed, defaults to "Unknown"' },
		{ raw: 'UNIT_ID',    normalized: 'unit',         type: 'string', transformation: 'direct, defaults to "Unknown"' },
		{ raw: 'AGENCY',     normalized: 'agency',       type: 'string', transformation: 'direct, nullable' },
		{ raw: 'YEAR_',      normalized: 'year',         type: 'number', transformation: 'direct, nullable' },
		{ raw: 'CAUSE',      normalized: 'cause',        type: 'string', transformation: 'decoded via 19-code lookup (CAL FIRE firestat.pdf)' },
		{ raw: 'GIS_ACRES',  normalized: 'acres',        type: 'number', transformation: 'rounded to integer, nullable' },
		{ raw: 'ALARM_DATE', normalized: 'startDate',    type: 'string', transformation: 'ms timestamp → ISO date string' },
		{ raw: 'CONT_DATE',  normalized: 'endDate',      type: 'string', transformation: 'ms timestamp → ISO date string' },
		{ raw: '(computed)', normalized: 'durationDays', type: 'number', transformation: '(endDate − startDate) in days, nullable' },
		{ raw: 'centroid.y', normalized: 'lat',          type: 'number', transformation: 'WGS84 latitude, nullable' },
		{ raw: 'centroid.x', normalized: 'lng',          type: 'number', transformation: 'WGS84 longitude, nullable' }
	];

	const PIPELINE_NODES = [
		{ title: 'ArcGIS FeatureServer',    subtitle: 'California Historic Fire Perimeters — paginated JSON API' },
		{ title: 'scripts/fetch-data.js',   subtitle: 'Paginates 2,000 records/page, normalizes fields, writes snapshot to disk' },
		{ title: 'static/incidents.json',   subtitle: 'Pre-built static snapshot — committed to repo and served from CDN at deploy time' },
		{ title: 'src/lib/api.js',          subtitle: 'Loads snapshot on first request; falls back to live ArcGIS API in local dev' },
		{ title: 'incidents store',         subtitle: 'Reactive Svelte writable store — all components read from here, never from the API directly' },
		{ title: 'src/lib/analytics.js',   subtitle: 'Pure functions — derive metrics and projections client-side, no extra network calls' }
	];

	let totalRecords = $state(0);
	let dateRange = $state('—');
	let percentUnknownCause = $state(0);
	let percentMissingAcres = $state(0);
	let isLoading = $state(false);
	let loadError = $state(null);

	// Canvas element references — plain variables, not $state (Chart.js must not be proxied)
	let acresCanvas = null;
	let costCanvas = null;
	let acresChart = null;
	let costChart = null;

	const sharedChartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: { legend: { display: false } },
		scales: {
			x: { ticks: { color: '#6b7280', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
			y: { beginAtZero: true, ticks: { color: '#6b7280', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.06)' } }
		}
	};

	function buildAcresChart(Chart, acresTrend) {
		const historicalCount = acresTrend.filter((point) => !point.projected).length;

		acresChart = new Chart(acresCanvas, {
			type: 'line',
			data: {
				labels: acresTrend.map((point) => point.year),
				datasets: [
					{
						data: acresTrend.map((point) => (point.projected ? null : point.acres)),
						borderColor: 'rgb(234, 88, 12)',
						backgroundColor: 'rgba(249, 115, 22, 0.08)',
						borderWidth: 2,
						pointRadius: 2,
						fill: true,
						tension: 0.3,
						spanGaps: false
					},
					{
						// Projection line — starts at the last historical point for a clean visual join
						data: acresTrend.map((point, index) =>
							point.projected || index === historicalCount - 1 ? point.acres : null
						),
						borderColor: '#9ca3af',
						borderDash: [6, 4],
						borderWidth: 2,
						pointRadius: 0,
						fill: false,
						tension: 0,
						spanGaps: false
					}
				]
			},
			options: {
				...sharedChartOptions,
				scales: {
					...sharedChartOptions.scales,
					y: {
						...sharedChartOptions.scales.y,
						title: { display: true, text: 'Total acres burned', color: '#9ca3af', font: { size: 11 } }
					}
				}
			}
		});
	}

	function buildCostChart(Chart, costTrend) {
		const historicalCount = costTrend.filter((point) => !point.projected).length;

		costChart = new Chart(costCanvas, {
			type: 'line',
			data: {
				labels: costTrend.map((point) => point.year),
				datasets: [
					{
						data: costTrend.map((point) => (point.projected ? null : point.cost)),
						borderColor: 'rgb(37, 99, 235)',
						backgroundColor: 'rgba(59, 130, 246, 0.08)',
						borderWidth: 2,
						pointRadius: 2,
						fill: true,
						tension: 0.3,
						spanGaps: false
					},
					{
						data: costTrend.map((point, index) =>
							point.projected || index === historicalCount - 1 ? point.cost : null
						),
						borderColor: '#9ca3af',
						borderDash: [6, 4],
						borderWidth: 2,
						pointRadius: 0,
						fill: false,
						tension: 0,
						spanGaps: false
					}
				]
			},
			options: {
				...sharedChartOptions,
				scales: {
					...sharedChartOptions.scales,
					y: {
						...sharedChartOptions.scales.y,
						ticks: {
							...sharedChartOptions.scales.y.ticks,
							callback: (value) => `$${(value / 1_000_000).toFixed(0)}M`
						},
						title: { display: true, text: 'Estimated cost (USD)', color: '#9ca3af', font: { size: 11 } }
					}
				}
			}
		});
	}

	onMount(async () => {
		const { Chart, registerables } = await import('chart.js');
		Chart.register(...registerables);

		// Track loading state for spinner/error display
		const unsubscribeLoadingState = loadingState.subscribe((state) => {
			isLoading = state.status === 'loading';
			if (state.status === 'error') loadError = state.error;
		});

		// Trigger a fetch if the user landed directly on this page (store not yet populated)
		let currentLoadingState;
		loadingState.subscribe((state) => { currentLoadingState = state; })();
		if (currentLoadingState.status === 'idle') {
			loadingState.set({ status: 'loading', error: null });
			try {
				const allIncidentsData = await fetchAllIncidents();
				incidents.set(allIncidentsData);
				loadingState.set({ status: 'success', error: null });
			} catch (fetchError) {
				loadingState.set({ status: 'error', error: fetchError.message });
			}
		}

		const unsubscribeIncidents = incidents.subscribe((allIncidentsData) => {
			if (allIncidentsData.length === 0) return;

			totalRecords = allIncidentsData.length;
			const years = allIncidentsData.map((incident) => incident.year).filter(Boolean).sort((a, b) => a - b);
			dateRange = years.length ? `${years[0]}–${years[years.length - 1]}` : '—';

			const unknownCauseCount = allIncidentsData.filter(
				(incident) => !incident.cause || incident.cause === 'Unknown'
			).length;
			percentUnknownCause = Math.round((unknownCauseCount / allIncidentsData.length) * 100);

			const missingAcresCount = allIncidentsData.filter((incident) => incident.acres == null).length;
			percentMissingAcres = Math.round((missingAcresCount / allIncidentsData.length) * 100);

			const acresTrend = computeAcresTrend(allIncidentsData);
			const costTrend = computeProjectedCost(acresTrend, COST_PER_ACRE);

			acresChart?.destroy();
			costChart?.destroy();

			buildAcresChart(Chart, acresTrend);
			buildCostChart(Chart, costTrend);
		});

		return () => {
			unsubscribeLoadingState();
			unsubscribeIncidents();
			acresChart?.destroy();
			costChart?.destroy();
		};
	});
</script>

<div class="min-h-dvh bg-gray-50">

	<!-- Header -->
	<header class="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 shadow-sm sm:px-6">
		<div class="flex items-center gap-3">
			<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-orange-500">
				<span class="text-sm font-bold text-white">🔥</span>
			</div>
			<div>
				<span class="text-base font-bold text-gray-900 sm:text-lg">calfire-explorer</span>
				<span class="ml-2 text-sm text-gray-400">/ Methodology</span>
			</div>
		</div>
		<a href="/" class="text-sm font-medium text-orange-600 transition-colors hover:text-orange-800">← Explorer</a>
	</header>

	<main class="mx-auto max-w-5xl px-4 py-10 sm:px-6">

		{#if isLoading}
			<div class="flex items-center justify-center py-24">
				<div class="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500"></div>
			</div>
		{:else if loadError}
			<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
		{:else}

		<!-- Section 1: Data Pipeline -->
		<section class="mb-14">
			<h2 class="mb-1 text-xl font-bold text-gray-900">Data Pipeline</h2>
			<p class="mb-8 text-sm text-gray-500">How raw ArcGIS API data becomes the normalized incident model powering this app.</p>

			<div class="flex flex-col items-center gap-0">
				{#each PIPELINE_NODES as node, index}
					<div class="w-full max-w-lg rounded-lg border border-gray-200 bg-white px-5 py-3.5 shadow-sm">
						<div class="font-mono text-sm font-semibold text-orange-700">{node.title}</div>
						<div class="mt-0.5 text-xs text-gray-500">{node.subtitle}</div>
					</div>
					{#if index < PIPELINE_NODES.length - 1}
						<div class="my-1.5 text-lg text-gray-300">↓</div>
					{/if}
				{/each}
			</div>
		</section>

		<!-- Section 2: Field Mapping -->
		<section class="mb-14">
			<h2 class="mb-1 text-xl font-bold text-gray-900">Field Mapping</h2>
			<p class="mb-6 text-sm text-gray-500">Every field in the normalized incident model, with its ArcGIS source and the transformation applied.</p>

			<div class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 bg-gray-50">
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Raw ArcGIS Field</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Normalized Field</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Type</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Transformation</th>
						</tr>
					</thead>
					<tbody>
						{#each FIELD_MAPPINGS as row, index}
							<tr class="border-b border-gray-100 {row.raw === '(computed)' ? 'bg-blue-50' : index % 2 !== 0 ? 'bg-gray-50' : ''}">
								<td class="px-4 py-2.5 font-mono text-xs text-gray-700">{row.raw}</td>
								<td class="px-4 py-2.5 font-mono text-xs font-semibold text-orange-700">{row.normalized}</td>
								<td class="px-4 py-2.5 text-xs text-gray-500">{row.type}</td>
								<td class="px-4 py-2.5 text-xs text-gray-600">{row.transformation}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>

		<!-- Section 3: Data Quality -->
		<section class="mb-14">
			<h2 class="mb-1 text-xl font-bold text-gray-900">Data Quality</h2>
			<p class="mb-6 text-sm text-gray-500">Honest accounting of coverage and gaps in the source data.</p>

			<div class="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
				<div class="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
					<div class="text-xs font-medium uppercase tracking-wide text-gray-400">Total Records</div>
					<div class="mt-1 text-2xl font-bold text-gray-900">{totalRecords.toLocaleString()}</div>
				</div>
				<div class="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
					<div class="text-xs font-medium uppercase tracking-wide text-gray-400">Date Range</div>
					<div class="mt-1 text-xl font-bold text-gray-900">{dateRange}</div>
				</div>
				<div class="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
					<div class="text-xs font-medium uppercase tracking-wide text-gray-400">Unknown Cause</div>
					<div class="mt-1 text-2xl font-bold text-amber-600">{percentUnknownCause}%</div>
				</div>
				<div class="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
					<div class="text-xs font-medium uppercase tracking-wide text-gray-400">Missing Acres</div>
					<div class="mt-1 text-2xl font-bold text-amber-600">{percentMissingAcres}%</div>
				</div>
			</div>

			<p class="text-sm text-gray-500">
				Unknown causes and missing acreage are concentrated in older records. Prior to the 1980s, standardized cause
				reporting was not consistently enforced across all CAL FIRE units, and GIS perimeter geometry — from which
				<code class="rounded bg-gray-100 px-1 text-xs">GIS_ACRES</code> is derived — was not always captured for
				smaller or older fires.
			</p>
		</section>

		<!-- Section 4: Cost & Projections -->
		<section class="mb-14">
			<h2 class="mb-1 text-xl font-bold text-gray-900">Cost &amp; Projections</h2>
			<p class="mb-6 text-sm text-gray-500">
				Estimated fire suppression cost derived from acreage data, with a 10-year linear regression projection.
				Solid lines show historical estimates; dashed gray lines show the projection.
			</p>

			<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
				<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
					<h3 class="mb-1 text-sm font-semibold text-gray-800">Acres Burned per Year</h3>
					<p class="mb-4 text-xs text-gray-400">Total acres across all incidents, 1950–present + 10-year projection</p>
					<div style="height: 280px;">
						<canvas bind:this={acresCanvas}></canvas>
					</div>
				</div>
				<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
					<h3 class="mb-1 text-sm font-semibold text-gray-800">Estimated Suppression Cost</h3>
					<p class="mb-4 text-xs text-gray-400">Acres × ${COST_PER_ACRE.toLocaleString()}/acre benchmark + 10-year projection</p>
					<div style="height: 280px;">
						<canvas bind:this={costCanvas}></canvas>
					</div>
				</div>
			</div>

			<p class="mt-4 text-xs text-gray-400">
				Cost estimates use a $2,500/acre suppression cost benchmark sourced from CAL FIRE's Fire and Resource
				Assessment Program (FRAP) — verify and link the specific report URL before publishing. Dollar values are
				modeled estimates derived from acreage data, not reported expenditures. Projection uses ordinary least
				squares linear regression on the full 1950–present series.
			</p>
		</section>

		{/if}
	</main>
</div>
```

- [ ] **Step 2: Verify the page loads from the main page**

With the dev server still running (`npm run dev`), open `http://localhost:5173`, click "Methodology" in the header. You should see all four sections load after the data fetches (spinner first, then content).

- [ ] **Step 3: Verify direct navigation also works**

Navigate directly to `http://localhost:5173/methodology` in a new tab (bypassing the main page). The page should load the data independently and render the same content.

- [ ] **Step 4: Verify the charts render correctly**

Confirm:
- Acres chart: orange solid line for historical data, gray dashed line extending 10 years past the last data point, both lines connected at the join year
- Cost chart: blue solid line for historical estimates, gray dashed projection
- Y-axis on the cost chart shows dollar values formatted as `$0M`, `$1M`, etc.

- [ ] **Step 5: Run the full test suite one more time**

```bash
npm run test -- --run
```

Expected:
```
Test Files  1 passed (1)
      Tests  27 passed (27)
```

- [ ] **Step 6: Commit**

```bash
git add src/routes/methodology/+page.svelte
git commit -m "Add methodology page with pipeline, field mapping, data quality, and cost projections"
```
