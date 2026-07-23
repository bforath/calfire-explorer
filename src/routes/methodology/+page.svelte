<!-- Methodology page — data pipeline, field mapping, data quality, and cost projections. -->

<script>
	import { onMount, tick } from 'svelte';
	import { get } from 'svelte/store';
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
	let activeTab = $state('acres');

	// Canvas element references — plain variables, not $state (Chart.js must not be proxied)
	let acresCanvas = null;
	let costCanvas = null;
	let acresChart = null;
	let costChart = null;

	// Stored so tab switches can rebuild the active chart without re-fetching
	let ChartConstructor = null;
	let acresTrendData = [];
	let costTrendData = [];

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
		if (!acresCanvas) return;
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
		if (!costCanvas) return;
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

	async function switchTab(tab) {
		activeTab = tab;
		await tick();
		if (tab === 'acres') {
			acresChart?.destroy();
			buildAcresChart(ChartConstructor, acresTrendData);
		} else {
			costChart?.destroy();
			buildCostChart(ChartConstructor, costTrendData);
		}
	}

	onMount(async () => {
		const { Chart, registerables } = await import('chart.js');
		Chart.register(...registerables);
		ChartConstructor = Chart;

		// Track loading state for spinner/error display
		const unsubscribeLoadingState = loadingState.subscribe((state) => {
			isLoading = state.status === 'loading';
			if (state.status === 'error') loadError = state.error;
			else loadError = null;
		});

		// Trigger a fetch if the user landed directly on this page (store not yet populated)
		if (get(loadingState).status === 'idle') {
			loadingState.set({ status: 'loading', error: null });
			try {
				const allIncidentsData = await fetchAllIncidents();
				incidents.set(allIncidentsData);
				loadingState.set({ status: 'success', error: null });
			} catch (fetchError) {
				loadingState.set({ status: 'error', error: fetchError.message });
			}
		}

		const unsubscribeIncidents = incidents.subscribe(async (allIncidentsData) => {
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

			acresTrendData = computeAcresTrend(allIncidentsData);
			costTrendData = computeProjectedCost(acresTrendData, COST_PER_ACRE);

			acresChart?.destroy();
			costChart?.destroy();

			// Wait for Svelte to flush DOM — canvases may not be mounted yet if
			// the loading state just changed from 'loading' to 'success' this tick
			await tick();

			if (activeTab === 'acres') {
				buildAcresChart(Chart, acresTrendData);
			} else {
				buildCostChart(Chart, costTrendData);
			}
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

		<!-- Section 1: Data Pipeline — always rendered, no dynamic data -->
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

		<!-- Section 2: Field Mapping — always rendered, no dynamic data -->
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

		<!-- Sections 3 & 4 are data-dependent — gated on loading/error state -->
		{#if isLoading}
			<div class="flex items-center justify-center py-24">
				<div class="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500"></div>
			</div>
		{:else if loadError}
			<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
		{:else}

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

			<div class="mb-4 flex w-fit gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
				<button
					onclick={() => switchTab('acres')}
					class="rounded-md px-4 py-1.5 text-sm font-medium transition-colors {activeTab === 'acres' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
				>
					Acres Burned
				</button>
				<button
					onclick={() => switchTab('cost')}
					class="rounded-md px-4 py-1.5 text-sm font-medium transition-colors {activeTab === 'cost' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
				>
					Estimated Cost
				</button>
			</div>

			<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
				{#if activeTab === 'acres'}
					<h3 class="mb-1 text-sm font-semibold text-gray-800">Acres Burned per Year</h3>
					<p class="mb-4 text-xs text-gray-400">Total acres across all incidents, 1950–present + 10-year projection</p>
					<div style="height: 280px;">
						<canvas bind:this={acresCanvas}></canvas>
					</div>
				{:else}
					<h3 class="mb-1 text-sm font-semibold text-gray-800">Estimated Suppression Cost</h3>
					<p class="mb-4 text-xs text-gray-400">Acres × ${COST_PER_ACRE.toLocaleString()}/acre benchmark + 10-year projection</p>
					<div style="height: 280px;">
						<canvas bind:this={costCanvas}></canvas>
					</div>
				{/if}
			</div>

			<!-- TODO: replace $2,500/acre with a linked citation from the FRAP annual report before publishing -->
			<p class="mt-4 text-xs text-gray-400">
				Cost estimates use a $2,500/acre suppression cost benchmark (CAL FIRE FRAP). Dollar values are modeled
				estimates derived from acreage data, not reported expenditures. Projection uses ordinary least squares
				linear regression on the full 1950–present series.
			</p>
		</section>

		{/if}
	</main>
</div>
