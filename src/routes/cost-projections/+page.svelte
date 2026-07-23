<!-- Cost & Projections page — estimated suppression cost with 10-year linear regression projection. -->

<script>
	import { onMount, tick } from 'svelte';
	import { get } from 'svelte/store';
	import { base } from '$app/paths';
	import { incidents, loadingState } from '$lib/stores.js';
	import { fetchAllIncidents } from '$lib/api.js';
	import { computeAcresTrend, computeProjectedCost } from '$lib/analytics.js';

	const COST_PER_ACRE = 2500;

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
		Chart.getChart(acresCanvas)?.destroy();
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
		Chart.getChart(costCanvas)?.destroy();
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

	onMount(() => {
		let destroyed = false;
		let cleanupLoadingState = () => {};
		let cleanupIncidents = () => {};

		(async () => {
			const { Chart, registerables } = await import('chart.js');
			if (destroyed) return;

			Chart.register(...registerables);
			ChartConstructor = Chart;

			cleanupLoadingState = loadingState.subscribe((state) => {
				isLoading = state.status === 'loading';
				if (state.status === 'error') loadError = state.error;
				else loadError = null;
			});

			if (get(loadingState).status === 'idle') {
				loadingState.set({ status: 'loading', error: null });
				try {
					const allIncidentsData = await fetchAllIncidents();
					if (destroyed) return;
					incidents.set(allIncidentsData);
					loadingState.set({ status: 'success', error: null });
				} catch (fetchError) {
					if (!destroyed) loadingState.set({ status: 'error', error: fetchError.message });
				}
			}

			if (destroyed) return;

			cleanupIncidents = incidents.subscribe(async (allIncidentsData) => {
				if (allIncidentsData.length === 0) return;

				acresTrendData = computeAcresTrend(allIncidentsData);
				costTrendData = computeProjectedCost(acresTrendData, COST_PER_ACRE);

				acresChart?.destroy();
				costChart?.destroy();

				// Wait for Svelte to flush DOM — canvases may not be mounted yet if
				// the loading state just changed from 'loading' to 'success' this tick
				await tick();

				if (destroyed) return;

				if (activeTab === 'acres') {
					buildAcresChart(Chart, acresTrendData);
				} else {
					buildCostChart(Chart, costTrendData);
				}
			});
		})();

		return () => {
			destroyed = true;
			cleanupLoadingState();
			cleanupIncidents();
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
				<span class="ml-2 text-sm text-gray-400">/ Cost &amp; Projections</span>
			</div>
		</div>
		<a href="{base}/" class="text-sm font-medium text-orange-600 transition-colors hover:text-orange-800">← Explorer</a>
	</header>

	<main class="mx-auto max-w-5xl px-4 py-10 sm:px-6">

		{#if isLoading}
			<div class="flex items-center justify-center py-24">
				<div class="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500"></div>
			</div>
		{:else if loadError}
			<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
		{:else}

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
					<div style="height: 320px;">
						<canvas bind:this={acresCanvas}></canvas>
					</div>
				{:else}
					<h3 class="mb-1 text-sm font-semibold text-gray-800">Estimated Suppression Cost</h3>
					<p class="mb-4 text-xs text-gray-400">Acres × ${COST_PER_ACRE.toLocaleString()}/acre benchmark + 10-year projection</p>
					<div style="height: 320px;">
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
