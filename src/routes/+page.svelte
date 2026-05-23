<!-- Main page — loads incident data on mount and assembles the layout. -->

<script>
	// onMount is Svelte's equivalent of Vue's mounted() lifecycle hook.
	// The function inside runs once, after the component is added to the DOM.
	import { onMount } from 'svelte';
	import { incidents, loadingState } from '$lib/stores.js';
	import { fetchAllIncidents } from '$lib/api.js';
	import DataTable from '$lib/components/DataTable.svelte';
	import StatsBar from '$lib/components/StatsBar.svelte';
	import FilterBar from '$lib/components/FilterBar.svelte';

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
	<header class="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
		<div class="flex items-center gap-2">
			<span class="text-xl font-bold text-orange-600">calfire-explorer</span>
			<span class="text-sm text-gray-400">California Wildfire Incidents</span>
		</div>
	</header>

	<!-- Main content area -->
	<main class="flex-1 overflow-hidden p-4">
		<!-- {#if} / {:else if} / {:else} is the Svelte equivalent of v-if / v-else-if / v-else -->
		{#if $loadingState.status === 'loading'}
			<div class="flex h-full items-center justify-center">
				<div class="text-center">
					<div class="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600"></div>
					<p class="text-gray-500">Loading wildfire data...</p>
				</div>
			</div>

		{:else if $loadingState.status === 'error'}
			<div class="flex h-full items-center justify-center">
				<div class="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
					<p class="font-semibold text-red-700">Failed to load data</p>
					<p class="mt-1 text-sm text-red-500">{$loadingState.error}</p>
				</div>
			</div>

		{:else if $loadingState.status === 'success'}
			<div class="flex h-full flex-col gap-3">
				<FilterBar />
				<StatsBar />
				<DataTable />
			</div>
		{/if}
	</main>
</div>
