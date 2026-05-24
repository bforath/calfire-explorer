<!-- Main page — loads incident data on mount and assembles the layout. -->

<script>
	import { onMount } from 'svelte';
	import { incidents, loadingState, filters } from '$lib/stores.js';
	import { fetchAllIncidents } from '$lib/api.js';
	import DataTable from '$lib/components/DataTable.svelte';
	import StatsBar from '$lib/components/StatsBar.svelte';
	import FilterSidebar from '$lib/components/FilterSidebar.svelte';
	import MapView from '$lib/components/MapView.svelte';
	import DetailPanel from '$lib/components/DetailPanel.svelte';
	import SearchOverlay from '$lib/components/SearchOverlay.svelte';
	import AnalyticsPanel from '$lib/components/AnalyticsPanel.svelte';

	let sidebarIsOpen = $state(false);
	let analyticsIsOpen = $state(false);

	let activeFilterCount = $derived(
		($filters.units.length > 0 ? 1 : 0) +
		($filters.causes.length > 0 ? 1 : 0) +
		($filters.acresRange[0] > 0 || $filters.acresRange[1] !== Infinity ? 1 : 0) +
		($filters.yearRange[0] > 1950 || $filters.yearRange[1] < new Date().getFullYear() ? 1 : 0)
	);

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

<div class="flex flex-col bg-gray-50 md:h-screen">
	<!-- Header -->
	<header class="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 shadow-sm sm:px-6">
		<div class="flex min-w-0 items-center gap-2 sm:gap-3">
			<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-orange-500">
				<span class="text-sm font-bold text-white">🔥</span>
			</div>
			<div class="min-w-0">
				<span class="text-base font-bold text-gray-900 sm:text-lg">calfire-explorer</span>
				<span class="ml-2 hidden text-sm text-gray-400 sm:inline">California Wildfire Incidents</span>
			</div>
		</div>
		<div class="flex flex-shrink-0 items-center gap-2 sm:gap-4">
			<!-- Analytics toggle -->
			<button
				onclick={() => (analyticsIsOpen = !analyticsIsOpen)}
				class="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm
					{analyticsIsOpen
						? 'border-orange-300 bg-orange-50 text-orange-700'
						: 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'}"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
				</svg>
				<span class="hidden sm:inline">Risk </span>Analytics
				{#if activeFilterCount > 0 && !analyticsIsOpen}
					<span class="rounded-full bg-orange-500 px-1.5 py-0.5 text-xs font-bold text-white">{activeFilterCount}</span>
				{/if}
			</button>
			<button
				class="flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm text-gray-500 hover:border-gray-300 hover:bg-gray-100 transition-colors sm:gap-2 sm:px-3"
				onclick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))}
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
				<span class="hidden sm:inline">Search</span>
				<kbd class="hidden rounded border border-gray-300 bg-white px-1 text-xs sm:inline">⌘K</kbd>
			</button>
			<span class="hidden text-xs text-gray-400 sm:inline">Data: CAL FIRE · California Historic Fire Perimeters</span>
		</div>
	</header>

	<SearchOverlay />

	<!-- Content -->
	<main class="flex flex-col md:flex-1 md:min-h-0 md:overflow-hidden">
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
			<!-- Explorer — always visible -->
			<div class="relative flex flex-col gap-3 p-4 md:flex-1 md:min-h-0 md:overflow-hidden">

				<!-- Backdrop — click to close filter sidebar -->
				{#if sidebarIsOpen}
					<div class="absolute inset-0 z-20 bg-black/20" onclick={() => (sidebarIsOpen = false)} role="presentation"></div>
				{/if}

				<!-- Filter sidebar -->
				<div class="absolute bottom-0 left-0 top-0 z-30 w-4/5 shadow-xl transition-transform duration-200 ease-out will-change-transform sm:w-64 {sidebarIsOpen ? 'translate-x-0' : '-translate-x-full'}">
					<FilterSidebar onClose={() => (sidebarIsOpen = false)} />
				</div>

				<!-- Filter toggle + stats row -->
				<div class="flex items-center gap-3">
					<button
						onclick={() => (sidebarIsOpen = !sidebarIsOpen)}
						class="flex flex-shrink-0 items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors
							{sidebarIsOpen
								? 'border-orange-300 bg-orange-50 text-orange-700'
								: 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'}"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M6 8h12M9 12h6M11 16h2" />
						</svg>
						Filters
						{#if activeFilterCount > 0}
							<span class="rounded-full bg-orange-500 px-1.5 py-0.5 text-xs font-bold text-white">{activeFilterCount}</span>
						{/if}
					</button>
					<div class="min-w-0 flex-1">
						<StatsBar />
					</div>
				</div>

				<!-- Table + Map -->
				<div class="flex flex-col gap-3 md:min-h-0 md:flex-1 md:flex-row">
					<!-- Map: fixed height on mobile, 40% on desktop -->
					<!-- isolate contains Leaflet's z-indexes so the filter sidebar renders above it -->
					<div class="relative isolate h-56 flex-shrink-0 overflow-hidden rounded-lg md:h-auto md:w-[40%]">
						<MapView />
						<DetailPanel />
					</div>
					<div class="md:order-first md:min-h-0 md:flex-1 md:w-[60%]">
						<DataTable />
					</div>
				</div>

				<!-- Analytics panel — slides up from the bottom when toggled -->
				<!-- Always rendered so charts subscribe to data on load; height animates via max-height -->
				<div class="flex-shrink-0 overflow-hidden transition-[max-height] duration-300 ease-in-out {analyticsIsOpen ? 'max-h-[272px]' : 'max-h-0'}">
					<AnalyticsPanel compact={true} />
				</div>

			</div>
		{/if}
	</main>
</div>
