<!-- Compact incident info card that slides up at the bottom of the map area. -->
<!-- The map stays fully visible — this never covers it completely. -->
<!-- Clicking a row shows this card AND zooms the map to that location. -->

<script>
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { incidents, uiState } from '$lib/stores.js';
	import { formatAcres, formatDate, formatDuration } from '$lib/utils.js';

	let selectedIncident = $derived($uiState.selectedIncident);

	let relatedFires = $derived(
		selectedIncident
			? $incidents
					.filter(
						(incident) =>
							incident.unit === selectedIncident.unit &&
							incident.id !== selectedIncident.id
					)
					.sort((fireA, fireB) => (fireB.year ?? 0) - (fireA.year ?? 0))
					.slice(0, 4)
			: []
	);

	function close() {
		uiState.update((currentState) => ({ ...currentState, selectedIncident: null }));
	}

	function severityLabel(acres) {
		if (acres == null)      return { label: 'Unknown',  classes: 'bg-gray-100 text-gray-600' };
		if (acres >= 100_000)   return { label: 'Extreme',  classes: 'bg-red-100 text-red-700' };
		if (acres >= 10_000)    return { label: 'Large',    classes: 'bg-orange-100 text-orange-700' };
		if (acres >= 1_000)     return { label: 'Moderate', classes: 'bg-yellow-100 text-yellow-700' };
		return                         { label: 'Small',    classes: 'bg-green-100 text-green-700' };
	}
</script>

<svelte:window onkeydown={(event) => { if (event.key === 'Escape') close(); }} />

{#if selectedIncident}
	<!-- Slides up from the bottom of the map, covering roughly the bottom third -->
	<div
		class="absolute bottom-0 left-0 right-0 z-20 rounded-b-lg border-t border-gray-200 bg-white shadow-lg"
		transition:fly={{ y: 200, duration: 250, easing: cubicOut }}
	>
		<!-- Header row -->
		<div class="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
			<div class="flex min-w-0 items-center gap-2">
				<span class="truncate font-semibold text-gray-900">{selectedIncident.name} FIRE</span>
				<span class="flex-shrink-0 rounded px-1.5 py-0.5 text-xs font-medium {severityLabel(selectedIncident.acres).classes}">
					{severityLabel(selectedIncident.acres).label}
				</span>
			</div>
			<button
				class="ml-2 flex-shrink-0 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
				onclick={close}
			>
				← Show all
			</button>
		</div>

		<!-- Stats row -->
		<div class="grid grid-cols-4 divide-x divide-gray-100 px-0">
			<div class="px-4 py-2.5">
				<div class="text-xs text-gray-400">Acres</div>
				<div class="font-semibold text-gray-900">{formatAcres(selectedIncident.acres)}</div>
			</div>
			<div class="px-4 py-2.5">
				<div class="text-xs text-gray-400">Duration</div>
				<div class="font-semibold text-gray-900">{formatDuration(selectedIncident.durationDays)}</div>
			</div>
			<div class="px-4 py-2.5">
				<div class="text-xs text-gray-400">Cause</div>
				<div class="truncate font-semibold text-gray-900">{selectedIncident.cause}</div>
			</div>
			<div class="px-4 py-2.5">
				<div class="text-xs text-gray-400">Started</div>
				<div class="font-semibold text-gray-900">{formatDate(selectedIncident.startDate)}</div>
			</div>
		</div>

		<!-- Related fires (if any) -->
		{#if relatedFires.length > 0}
			<div class="border-t border-gray-100 px-4 py-2">
				<div class="mb-1 text-xs text-gray-400">Other fires in unit {selectedIncident.unit}</div>
				<div class="flex flex-wrap gap-1">
					{#each relatedFires as fire}
						<button
							class="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100 transition-colors"
							onclick={() => uiState.update((state) => ({ ...state, selectedIncident: fire }))}
						>
							{fire.name} · {fire.year}
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/if}
