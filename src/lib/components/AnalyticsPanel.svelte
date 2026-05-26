<!-- Risk analytics dashboard — four Chart.js charts derived from the full incident dataset. -->
<!-- Charts are clickable: selecting a bar/point cross-filters the Explorer table and map. -->

<script>
	import { onMount } from 'svelte';
	import { incidents, filters, filteredIncidents } from '$lib/stores.js';

	let { compact = false } = $props();
	import {
		computeUnitRiskScores,
		computeFiresPerYear,
		computeCauseBreakdown,
		computeAcresByDecade
	} from '$lib/analytics.js';

	// Canvas element references — plain variables, not $state (Chart.js objects must not be proxied)
	let riskCanvas = null;
	let trendCanvas = null;
	let causeCanvas = null;
	let decadeCanvas = null;

	// Chart instances — held so we can destroy them on unmount
	let riskChart = null;
	let trendChart = null;
	let causeChart = null;
	let decadeChart = null;

	// Full incident dataset stored so the filters subscriber can re-slice it without a rebuild
	let allIncidentsData = [];

	// Data arrays kept in scope so color-update functions can re-derive colors without rebuilding
	let unitRiskScoresData = [];
	let firesPerYearData = [];
	let causeBreakdownData = [];
	let acresByDecadeData = [];

	// The full year extent of the dataset — used to detect when the year filter is non-default
	let dataMinYear = $state(1950);
	let dataMaxYear = $state(new Date().getFullYear());

	// Summary KPI values shown above the charts
	let topRiskUnit = $state('');
	let peakFireYear = $state('');
	let peakFireCount = $state(0);
	let peakFireAcres = $state(0);
	let topFiveCauses = $state([]);
	let latestDecadeAverageAcres = $state(0);

	// Cross-filter indicator
	let hasCrossFilter = $derived(
		$filters.units.length > 0 ||
		$filters.causes.length > 0 ||
		$filters.yearRange[0] > dataMinYear ||
		$filters.yearRange[1] < dataMaxYear
	);

	const ORANGE       = 'rgba(249, 115, 22, 0.85)';
	const ORANGE_LIGHT = 'rgba(249, 115, 22, 0.45)';
	const ORANGE_BORDER = 'rgb(234, 88, 12)';
	const RED   = 'rgba(220, 38, 38, 0.8)';
	const AMBER = 'rgba(245, 158, 11, 0.8)';
	const BLUE_BORDER = 'rgb(37, 99, 235)';
	const DIMMED = 'rgba(156, 163, 175, 0.25)';

	const sharedDefaults = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: { legend: { display: false } },
		scales: {
			x: { ticks: { color: '#6b7280', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
			y: { ticks: { color: '#6b7280', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.06)' } }
		}
	};

	// ---------------------------------------------------------------------------
	// Color updaters — called on every filter change to highlight selected items
	// ---------------------------------------------------------------------------

	function updateRiskColors(currentFilters) {
		if (!riskChart || unitRiskScoresData.length === 0) return;
		const hasFilter = currentFilters.units.length > 0;
		riskChart.data.datasets[0].backgroundColor = unitRiskScoresData.map((entry) => {
			const baseColor = entry.riskScore >= 80 ? RED : entry.riskScore >= 50 ? ORANGE : AMBER;
			if (!hasFilter) return baseColor;
			return currentFilters.units.includes(entry.unit) ? baseColor : DIMMED;
		});
		riskChart.update('none');
	}

	function updateTrendColors(currentFilters) {
		if (!trendChart || firesPerYearData.length === 0) return;
		const [yearMin, yearMax] = currentFilters.yearRange;
		const isFiltered = yearMin > dataMinYear || yearMax < dataMaxYear;
		trendChart.data.datasets[0].pointBackgroundColor = firesPerYearData.map((entry) =>
			!isFiltered || (entry.year >= yearMin && entry.year <= yearMax) ? ORANGE_BORDER : DIMMED
		);
		trendChart.data.datasets[0].pointRadius = firesPerYearData.map((entry) =>
			!isFiltered ? 2 : entry.year >= yearMin && entry.year <= yearMax ? 4 : 1
		);
		trendChart.data.datasets[0].borderColor = isFiltered ? 'rgba(234,88,12,0.3)' : ORANGE_BORDER;
		trendChart.data.datasets[0].backgroundColor = isFiltered ? 'rgba(249,115,22,0.03)' : 'rgba(249,115,22,0.08)';
		trendChart.update('none');
	}

	function updateCauseColors(currentFilters) {
		if (!causeChart || causeBreakdownData.length === 0) return;
		const hasFilter = currentFilters.causes.length > 0;
		causeChart.data.datasets[0].backgroundColor = causeBreakdownData.map((entry, index) => {
			if (!hasFilter) {
				const opacity = Math.max(0.9 - index * 0.05, 0.3);
				return `rgba(249, 115, 22, ${opacity})`;
			}
			return currentFilters.causes.includes(entry.cause) ? ORANGE : DIMMED;
		});
		causeChart.update('none');
	}

	function updateDecadeColors(currentFilters) {
		if (!decadeChart || acresByDecadeData.length === 0) return;
		const [yearMin, yearMax] = currentFilters.yearRange;
		const isFiltered = yearMin > dataMinYear || yearMax < dataMaxYear;
		decadeChart.data.datasets[0].pointBackgroundColor = acresByDecadeData.map((entry) =>
			!isFiltered || (entry.decade >= yearMin && entry.decade + 9 <= yearMax) ? BLUE_BORDER : DIMMED
		);
		decadeChart.data.datasets[0].pointRadius = acresByDecadeData.map((entry) =>
			!isFiltered ? 4 : entry.decade >= yearMin && entry.decade + 9 <= yearMax ? 7 : 2
		);
		decadeChart.update('none');
	}

	function updateAllChartColors(currentFilters) {
		updateRiskColors(currentFilters);
		updateTrendColors(currentFilters);
		updateCauseColors(currentFilters);
		updateDecadeColors(currentFilters);
	}

	// ---------------------------------------------------------------------------
	// Chart builders
	// ---------------------------------------------------------------------------

	function buildRiskChart(Chart, allIncidents) {
		unitRiskScoresData = computeUnitRiskScores(allIncidents, 15);
		topRiskUnit = unitRiskScoresData[0]?.unit ?? '—';

		const colors = unitRiskScoresData.map((entry) =>
			entry.riskScore >= 80 ? RED : entry.riskScore >= 50 ? ORANGE : AMBER
		);

		riskChart = new Chart(riskCanvas, {
			type: 'bar',
			data: {
				labels: unitRiskScoresData.map((entry) => entry.unit),
				datasets: [{ data: unitRiskScoresData.map((entry) => entry.riskScore), backgroundColor: colors, borderWidth: 0, borderRadius: 4 }]
			},
			options: {
				...sharedDefaults,
				indexAxis: 'y',
				onClick: (event, elements) => {
					if (!elements.length) return;
					const clickedUnit = unitRiskScoresData[elements[0].index].unit;
					filters.update((currentFilters) => ({
						...currentFilters,
						units: currentFilters.units.includes(clickedUnit)
							? currentFilters.units.filter((unit) => unit !== clickedUnit)
							: [...currentFilters.units, clickedUnit]
					}));
				},
				onHover: (event, elements) => { event.native.target.style.cursor = elements.length ? 'pointer' : 'default'; },
				plugins: {
					...sharedDefaults.plugins,
					tooltip: {
						callbacks: {
							label: (context) => {
								const entry = unitRiskScoresData[context.dataIndex];
								return [` Risk score: ${entry.riskScore}`, ` Avg acres: ${entry.averageAcres.toLocaleString()}`, ` Total fires: ${entry.fireCount.toLocaleString()}`];
							}
						}
					}
				},
				scales: {
					...sharedDefaults.scales,
					x: { ...sharedDefaults.scales.x, min: 0, max: 100, title: { display: true, text: 'Risk Score (0–100)', color: '#9ca3af', font: { size: 11 } } },
					y: { ...sharedDefaults.scales.y, ticks: { color: '#374151', font: { size: 11, weight: '500' } } }
				}
			}
		});
	}

	function buildTrendChart(Chart, allIncidents) {
		firesPerYearData = computeFiresPerYear(allIncidents, 1950);
		const peakEntry = firesPerYearData.reduce(
			(best, entry) => (entry.count > best.count ? entry : best),
			{ count: 0, year: null }
		);
		peakFireYear = peakEntry.year ?? '—';
		peakFireCount = peakEntry.count;
		peakFireAcres = allIncidents
			.filter((incident) => incident.year === peakEntry.year)
			.reduce((total, incident) => total + (incident.acres ?? 0), 0);

		trendChart = new Chart(trendCanvas, {
			type: 'line',
			data: {
				labels: firesPerYearData.map((entry) => entry.year),
				datasets: [{
					data: firesPerYearData.map((entry) => entry.count),
					borderColor: ORANGE_BORDER,
					backgroundColor: 'rgba(249, 115, 22, 0.08)',
					borderWidth: 2,
					pointRadius: 2,
					pointHoverRadius: 5,
					pointBackgroundColor: ORANGE_BORDER,
					fill: true,
					tension: 0.3
				}]
			},
			options: {
				...sharedDefaults,
				onClick: (event, elements) => {
					if (!elements.length) return;
					const clickedYear = firesPerYearData[elements[0].index].year;
					filters.update((currentFilters) => {
						const alreadySelected = currentFilters.yearRange[0] === clickedYear && currentFilters.yearRange[1] === clickedYear;
						return { ...currentFilters, yearRange: alreadySelected ? [dataMinYear, dataMaxYear] : [clickedYear, clickedYear] };
					});
				},
				onHover: (event, elements) => { event.native.target.style.cursor = elements.length ? 'pointer' : 'default'; },
				plugins: {
					...sharedDefaults.plugins,
					tooltip: { callbacks: { label: (context) => ` ${context.parsed.y.toLocaleString()} fires` } }
				},
				scales: {
					...sharedDefaults.scales,
					y: { ...sharedDefaults.scales.y, beginAtZero: true, title: { display: true, text: 'Fires recorded', color: '#9ca3af', font: { size: 11 } } }
				}
			}
		});
	}

	function buildCauseChart(Chart, allIncidents) {
		causeBreakdownData = computeCauseBreakdown(allIncidents).slice(0, 12);
		topFiveCauses = causeBreakdownData.slice(0, 5);

		const colors = causeBreakdownData.map((_, index) => `rgba(249, 115, 22, ${Math.max(0.9 - index * 0.05, 0.3)})`);

		causeChart = new Chart(causeCanvas, {
			type: 'bar',
			data: {
				labels: causeBreakdownData.map((entry) => entry.cause),
				datasets: [{ data: causeBreakdownData.map((entry) => entry.count), backgroundColor: colors, borderWidth: 0, borderRadius: 4 }]
			},
			options: {
				...sharedDefaults,
				indexAxis: 'y',
				onClick: (event, elements) => {
					if (!elements.length) return;
					const clickedCause = causeBreakdownData[elements[0].index].cause;
					filters.update((currentFilters) => ({
						...currentFilters,
						causes: currentFilters.causes.includes(clickedCause)
							? currentFilters.causes.filter((cause) => cause !== clickedCause)
							: [...currentFilters.causes, clickedCause]
					}));
				},
				onHover: (event, elements) => { event.native.target.style.cursor = elements.length ? 'pointer' : 'default'; },
				plugins: {
					...sharedDefaults.plugins,
					tooltip: { callbacks: { label: (context) => ` ${context.parsed.x.toLocaleString()} fires` } }
				},
				scales: {
					...sharedDefaults.scales,
					x: { ...sharedDefaults.scales.x, beginAtZero: true, title: { display: true, text: 'Number of fires', color: '#9ca3af', font: { size: 11 } } },
					y: { ...sharedDefaults.scales.y, ticks: { color: '#374151', font: { size: 11 } } }
				}
			}
		});
	}

	function buildDecadeChart(Chart, allIncidents) {
		acresByDecadeData = computeAcresByDecade(allIncidents);
		const latestDecade = acresByDecadeData[acresByDecadeData.length - 1];
		latestDecadeAverageAcres = latestDecade?.averageAcres ?? 0;

		decadeChart = new Chart(decadeCanvas, {
			type: 'line',
			data: {
				labels: acresByDecadeData.map((entry) => `${entry.decade}s`),
				datasets: [{
					data: acresByDecadeData.map((entry) => entry.averageAcres),
					borderColor: BLUE_BORDER,
					backgroundColor: 'rgba(59, 130, 246, 0.08)',
					borderWidth: 2,
					pointRadius: 4,
					pointBackgroundColor: BLUE_BORDER,
					pointHoverRadius: 7,
					fill: true,
					tension: 0.3
				}]
			},
			options: {
				...sharedDefaults,
				onClick: (event, elements) => {
					if (!elements.length) return;
					const entry = acresByDecadeData[elements[0].index];
					const decadeStart = entry.decade;
					const decadeEnd = entry.decade + 9;
					filters.update((currentFilters) => {
						const alreadySelected = currentFilters.yearRange[0] === decadeStart && currentFilters.yearRange[1] === decadeEnd;
						return { ...currentFilters, yearRange: alreadySelected ? [dataMinYear, dataMaxYear] : [decadeStart, decadeEnd] };
					});
				},
				onHover: (event, elements) => { event.native.target.style.cursor = elements.length ? 'pointer' : 'default'; },
				plugins: {
					...sharedDefaults.plugins,
					tooltip: {
						callbacks: {
							label: (context) => {
								const entry = acresByDecadeData[context.dataIndex];
								return [` Avg: ${context.parsed.y.toLocaleString()} acres`, ` Sample: ${entry.fireCount.toLocaleString()} fires`];
							}
						}
					}
				},
				scales: {
					...sharedDefaults.scales,
					y: { ...sharedDefaults.scales.y, beginAtZero: true, title: { display: true, text: 'Avg acres per fire', color: '#9ca3af', font: { size: 11 } } }
				}
			}
		});
	}

	function updateRiskChartData(subsetIncidents) {
		if (!riskChart) return;
		const newRiskScores = computeUnitRiskScores(subsetIncidents, 15);
		unitRiskScoresData = newRiskScores;
		topRiskUnit = newRiskScores[0]?.unit ?? '—';
		riskChart.data.labels = newRiskScores.map((entry) => entry.unit);
		riskChart.data.datasets[0].data = newRiskScores.map((entry) => entry.riskScore);
		riskChart.update('none');
	}

	function updateDependentChartData(subsetIncidents) {
		if (!trendChart || !causeChart || !decadeChart) return;

		const newFiresPerYear = computeFiresPerYear(subsetIncidents, 1950);
		firesPerYearData = newFiresPerYear;
		trendChart.data.labels = newFiresPerYear.map((entry) => entry.year);
		trendChart.data.datasets[0].data = newFiresPerYear.map((entry) => entry.count);

		const peakEntry = newFiresPerYear.reduce(
			(best, entry) => (entry.count > best.count ? entry : best),
			{ count: 0, year: null }
		);
		peakFireYear = peakEntry.year ?? '—';
		peakFireCount = peakEntry.count;
		peakFireAcres = subsetIncidents
			.filter((incident) => incident.year === peakEntry.year)
			.reduce((total, incident) => total + (incident.acres ?? 0), 0);

		const newCauseBreakdown = computeCauseBreakdown(subsetIncidents).slice(0, 12);
		causeBreakdownData = newCauseBreakdown;
		topFiveCauses = newCauseBreakdown.slice(0, 5);
		causeChart.data.labels = newCauseBreakdown.map((entry) => entry.cause);
		causeChart.data.datasets[0].data = newCauseBreakdown.map((entry) => entry.count);

		const newAcresByDecade = computeAcresByDecade(subsetIncidents);
		acresByDecadeData = newAcresByDecade;
		const latestDecade = newAcresByDecade[newAcresByDecade.length - 1];
		latestDecadeAverageAcres = latestDecade?.averageAcres ?? 0;
		decadeChart.data.labels = newAcresByDecade.map((entry) => `${entry.decade}s`);
		decadeChart.data.datasets[0].data = newAcresByDecade.map((entry) => entry.averageAcres);
	}

	function clearCrossFilters() {
		filters.update((currentFilters) => ({
			...currentFilters,
			units: [],
			causes: [],
			yearRange: [dataMinYear, dataMaxYear]
		}));
	}

	onMount(async () => {
		const { Chart, registerables } = await import('chart.js');
		Chart.register(...registerables);

		const unsubscribeIncidents = incidents.subscribe((allIncidents) => {
			if (allIncidents.length === 0) return;

			allIncidentsData = allIncidents;
			dataMinYear = Math.min(...allIncidents.map((incident) => incident.year).filter(Boolean));
			dataMaxYear = new Date().getFullYear(); // reassigning $state is fine — Svelte tracks it

			riskChart?.destroy();
			trendChart?.destroy();
			causeChart?.destroy();
			decadeChart?.destroy();

			buildRiskChart(Chart, allIncidents);
			buildTrendChart(Chart, allIncidents);
			buildCauseChart(Chart, allIncidents);
			buildDecadeChart(Chart, allIncidents);

			// Apply any filters that were already active when the panel first mounts
			updateAllChartColors($filters);
		});

		const unsubscribeFilters = filters.subscribe((currentFilters) => {
			if (allIncidentsData.length > 0) {
				const yearFilteredIncidents = allIncidentsData.filter((incident) =>
					!incident.year ||
					(incident.year >= currentFilters.yearRange[0] && incident.year <= currentFilters.yearRange[1])
				);
				const subsetIncidents = currentFilters.units.length > 0
					? yearFilteredIncidents.filter((incident) => currentFilters.units.includes(incident.unit))
					: yearFilteredIncidents;
				updateRiskChartData(yearFilteredIncidents);
				updateDependentChartData(subsetIncidents);
			}
			updateAllChartColors(currentFilters);
		});

		return () => {
			unsubscribeIncidents();
			unsubscribeFilters();
			riskChart?.destroy();
			trendChart?.destroy();
			causeChart?.destroy();
			decadeChart?.destroy();
		};
	});
</script>

<div class="flex h-full flex-col gap-3 overflow-y-auto {compact ? 'pt-3' : 'p-1'}">

	<!-- Compact KPI strip — shown only in compact mode -->
	{#if compact}
		<div class="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs shadow-sm">
			<span class="text-gray-400">Highest risk: <span class="font-semibold text-red-600">{topRiskUnit}</span></span>
			<span class="text-gray-300">·</span>
			<span class="text-gray-400">Peak year: <span class="font-semibold text-orange-600">{peakFireYear}</span> <span class="text-gray-500">({peakFireCount.toLocaleString()} fires · {Math.round(peakFireAcres).toLocaleString()} ac)</span></span>
			<span class="text-gray-300">·</span>
			<span class="text-gray-400">Top cause: <span class="font-semibold text-amber-600">{topFiveCauses[0]?.cause ?? '—'}</span></span>
			<span class="text-gray-300">·</span>
			<span class="text-gray-400">Latest decade avg: <span class="font-semibold text-blue-600">{latestDecadeAverageAcres.toLocaleString()} ac/fire</span></span>
		</div>
	{/if}

	<!-- KPI summary row — hidden in compact mode -->
	{#if !compact}
	<div class="grid grid-cols-2 gap-3 md:grid-cols-4">
		<div class="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
			<div class="text-xs font-medium uppercase tracking-wide text-gray-400">Highest Risk Unit</div>
			<div class="mt-1 text-xl font-bold text-red-600">{topRiskUnit}</div>
			<div class="mt-0.5 text-xs text-gray-400">by frequency × severity</div>
		</div>
		<div class="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
			<div class="text-xs font-medium uppercase tracking-wide text-gray-400">Peak Fire Year</div>
			<div class="mt-1 text-xl font-bold text-orange-600">{peakFireYear}</div>
			<div class="mt-1.5 flex flex-col gap-0.5">
				<div class="flex items-center justify-between">
					<span class="text-xs text-gray-400">Fires</span>
					<span class="text-xs font-semibold text-orange-600">{peakFireCount.toLocaleString()}</span>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-xs text-gray-400">Acres burned</span>
					<span class="text-xs font-semibold text-orange-600">{Math.round(peakFireAcres).toLocaleString()}</span>
				</div>
			</div>
		</div>
		<div class="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
			<div class="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Top Causes</div>
			{#each topFiveCauses as entry, index}
				<div class="flex items-center justify-between {index < topFiveCauses.length - 1 ? 'mb-1' : ''}">
					<span class="mr-2 truncate text-xs text-gray-700">{entry.cause}</span>
					<span class="flex-shrink-0 text-xs font-semibold text-amber-600">{entry.count.toLocaleString()}</span>
				</div>
			{/each}
		</div>
		<div class="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
			<div class="text-xs font-medium uppercase tracking-wide text-gray-400">Latest Decade Avg</div>
			<div class="mt-1 text-xl font-bold text-blue-600">{latestDecadeAverageAcres.toLocaleString()} ac</div>
			<div class="mt-0.5 text-xs text-gray-400">average acres per fire</div>
		</div>
	</div>
	{/if}

	<!-- Cross-filter active banner -->
	{#if hasCrossFilter}
		<div class="flex flex-wrap items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5">
			<span class="text-xs font-semibold text-orange-700">Filtering Explorer:</span>

			{#each $filters.causes as cause}
				<button
					onclick={() => filters.update((f) => ({ ...f, causes: f.causes.filter((c) => c !== cause) }))}
					class="flex items-center gap-1 rounded-full border border-orange-300 bg-white px-2 py-0.5 text-xs text-orange-700 hover:bg-orange-100 transition-colors"
				>
					Cause: {cause} <span class="text-orange-400">✕</span>
				</button>
			{/each}

			{#each $filters.units as unit}
				<button
					onclick={() => filters.update((f) => ({ ...f, units: f.units.filter((u) => u !== unit) }))}
					class="flex items-center gap-1 rounded-full border border-orange-300 bg-white px-2 py-0.5 text-xs text-orange-700 hover:bg-orange-100 transition-colors"
				>
					Unit: {unit} <span class="text-orange-400">✕</span>
				</button>
			{/each}

			{#if $filters.yearRange[0] > dataMinYear || $filters.yearRange[1] < dataMaxYear}
				<button
					onclick={() => filters.update((f) => ({ ...f, yearRange: [dataMinYear, dataMaxYear] }))}
					class="flex items-center gap-1 rounded-full border border-orange-300 bg-white px-2 py-0.5 text-xs text-orange-700 hover:bg-orange-100 transition-colors"
				>
					Year: {$filters.yearRange[0]}{$filters.yearRange[0] === $filters.yearRange[1] ? '' : `–${$filters.yearRange[1]}`}
					<span class="text-orange-400">✕</span>
				</button>
			{/if}

			<span class="text-xs text-orange-500">
				{$filteredIncidents.length.toLocaleString()} matching incidents
			</span>

			<button
				onclick={clearCrossFilters}
				class="ml-auto text-xs text-orange-600 underline hover:text-orange-800 transition-colors"
			>
				Clear all
			</button>
		</div>
	{/if}

	<!-- Charts grid — click any bar or point to cross-filter the table and map above -->
	<div class="grid min-h-0 flex-1 gap-3 {compact ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2'}">

		<div class="flex flex-col rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
			<div class="mb-2">
				<h3 class="text-xs font-semibold text-gray-800">Unit Risk Score</h3>
				{#if !compact}<p class="mt-0.5 text-xs text-gray-400">Click a bar to filter · frequency × log(avg acres), normalized 0–100</p>{/if}
			</div>
			<div class="min-h-0 flex-1" style="height: {compact ? '160px' : '280px'};">
				<canvas bind:this={riskCanvas}></canvas>
			</div>
		</div>

		<div class="flex flex-col rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
			<div class="mb-2">
				<h3 class="text-xs font-semibold text-gray-800">Fires per Year</h3>
				{#if !compact}<p class="mt-0.5 text-xs text-gray-400">Click a point to filter to that year</p>{/if}
			</div>
			<div class="min-h-0 flex-1" style="height: {compact ? '160px' : '280px'};">
				<canvas bind:this={trendCanvas}></canvas>
			</div>
		</div>

		<div class="flex flex-col rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
			<div class="mb-2">
				<h3 class="text-xs font-semibold text-gray-800">Fires by Cause</h3>
				{#if !compact}<p class="mt-0.5 text-xs text-gray-400">Click a bar to filter · top 12 causes</p>{/if}
			</div>
			<div class="min-h-0 flex-1" style="height: {compact ? '160px' : '280px'};">
				<canvas bind:this={causeCanvas}></canvas>
			</div>
		</div>

		<div class="flex flex-col rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
			<div class="mb-2">
				<h3 class="text-xs font-semibold text-gray-800">Avg Fire Size by Decade</h3>
				{#if !compact}<p class="mt-0.5 text-xs text-gray-400">Click a point to filter to that decade</p>{/if}
			</div>
			<div class="min-h-0 flex-1" style="height: {compact ? '160px' : '280px'};">
				<canvas bind:this={decadeCanvas}></canvas>
			</div>
		</div>

	</div>
</div>
