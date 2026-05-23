<!-- Main page — loads incident data on mount and assembles the layout. -->

<script>
	import { onMount } from 'svelte';
	import { incidents, loadingState } from '$lib/stores.js';
	import { fetchAllIncidents } from '$lib/api.js';
	import DataTable from '$lib/components/DataTable.svelte';
	import StatsBar from '$lib/components/StatsBar.svelte';
	import FilterBar from '$lib/components/FilterBar.svelte';
	import MapView from '$lib/components/MapView.svelte';
	import DetailPanel from '$lib/components/DetailPanel.svelte';
	import SearchOverlay from '$lib/components/SearchOverlay.svelte';

	onMount(async () => {
		loadingState.set({ status: 'loading', error: null });
		try {
			const allIncidents = await fetchAllIncidents();
			incidents.set(allIncidents);
			loadingState.set({ status: 'success', error: null });
		} catch (fetchError) {
			loadingState.set({ status: 'error', error: fetchError.message });
		}
	});
</script>

<div class="flex h-screen flex-col bg-gray-50">
	<!-- Header -->
	<header class="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
		<div class="flex items-center gap-3">
			<div class="flex h-8 w-8 items-center justify-center rounded-md bg-orange-500">
				<span class="text-sm font-bold text-white">🔥</span>
			</div>
			<div>
				<span class="text-lg font-bold text-gray-900">calfire-explorer</span>
				<span class="ml-2 text-sm text-gray-400">California Wildfire Incidents</span>
			</div>
		</div>
		<div class="flex items-center gap-4">
			<button
				class="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-500 hover:border-gray-300 hover:bg-gray-100 transition-colors"
				onclick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))}
			>
				<span>Search</span>
				<kbd class="rounded border border-gray-300 bg-white px-1 text-xs">⌘K</kbd>
			</button>
			<span class="text-xs text-gray-400">Data: CAL FIRE · California Historic Fire Perimeters</span>
		</div>
	</header>

	<SearchOverlay />

	<!-- Content -->
	<main class="flex min-h-0 flex-1 flex-col gap-3 p-4">
		{#if $loadingState.status === 'loading'}
			<div class="flex flex-1 items-center justify-center">
				<div class="text-center">
					<div class="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600"></div>
					<p class="text-gray-500">Loading wildfire data...</p>
					<p class="mt-1 text-xs text-gray-400">Fetching 23,000+ incidents</p>
				</div>
			</div>

		{:else if $loadingState.status === 'error'}
			<div class="flex flex-1 items-center justify-center">
				<div class="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
					<p class="font-semibold text-red-700">Failed to load data</p>
					<p class="mt-1 text-sm text-red-500">{$loadingState.error}</p>
				</div>
			</div>

		{:else if $loadingState.status === 'success'}
			<FilterBar />
			<StatsBar />

			<!-- Two-panel layout: table 60%, map 40% -->
			<div class="flex min-h-0 flex-1 gap-3">
				<div class="flex min-h-0 w-[60%] flex-col">
					<DataTable />
				</div>
				<!-- relative here lets DetailPanel use absolute positioning to overlay the map -->
				<div class="relative w-[40%]">
					<MapView />
					<DetailPanel />
				</div>
			</div>
		{/if}
	</main>
</div>
