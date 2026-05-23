<!-- Slide-out panel showing full details for the selected incident. -->
<!-- Triggered by clicking a table row or map dot. Escape or X closes it. -->

<script>
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { incidents, uiState } from '$lib/stores.js';
	import { formatAcres, formatDate, formatDuration } from '$lib/utils.js';

	let selectedIncident = $derived($uiState.selectedIncident);

	// Find up to 5 other fires in the same unit, excluding the current one,
	// sorted by most recent first
	let relatedFires = $derived(
		selectedIncident
			? $incidents
					.filter(
						(incident) =>
							incident.unit === selectedIncident.unit &&
							incident.id !== selectedIncident.id &&
							incident.year != null
					)
					.sort((fireA, fireB) => (fireB.year ?? 0) - (fireA.year ?? 0))
					.slice(0, 5)
			: []
	);

	// Timeline width as a percentage — how far through its burn the fire was
	let timelineProgress = $derived(() => {
		if (!selectedIncident?.startDate || !selectedIncident?.endDate) return 100;
		const totalMilliseconds =
			new Date(selectedIncident.endDate) - new Date(selectedIncident.startDate);
		if (totalMilliseconds <= 0) return 100;
		return 100;
	});

	function close() {
		uiState.update((currentState) => ({ ...currentState, selectedIncident: null }));
	}

	function handleKeydown(event) {
		if (event.key === 'Escape') close();
	}

	function acresSeverityClass(acres) {
		if (acres == null)      return 'bg-gray-100 text-gray-600';
		if (acres >= 100_000)   return 'bg-red-100 text-red-700';
		if (acres >= 10_000)    return 'bg-orange-100 text-orange-700';
		if (acres >= 1_000)     return 'bg-yellow-100 text-yellow-700';
		return                         'bg-green-100 text-green-700';
	}
</script>

<!-- svelte:window lets you attach event listeners to the browser window from within -->
<!-- a component — no manual addEventListener/removeEventListener needed.           -->
<!-- Vue equivalent: adding the listener in mounted() and removing in unmounted().  -->
<svelte:window onkeydown={handleKeydown} />

{#if selectedIncident}
	<!-- Backdrop — semi-transparent overlay behind the panel -->
	<!-- transition:fade adds a fade-in/out animation. duration is in milliseconds. -->
	<div
		class="absolute inset-0 z-20 bg-black/20"
		transition:fade={{ duration: 150 }}
		onclick={close}
		role="presentation"
	></div>

	<!-- Panel — slides in from the right -->
	<!-- transition:fly animates the x position from +400px to 0.               -->
	<!-- easing: cubicOut makes it decelerate as it arrives, like a native sheet.-->
	<div
		class="absolute bottom-0 right-0 top-0 z-30 flex w-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl"
		transition:fly={{ x: 400, duration: 280, easing: cubicOut }}
		role="dialog"
		aria-label="Incident details"
	>
		<!-- Header -->
		<div class="flex items-start justify-between border-b border-gray-100 bg-gray-50 px-5 py-4">
			<div class="min-w-0 flex-1 pr-4">
				<h2 class="truncate text-lg font-bold text-gray-900">{selectedIncident.name} FIRE</h2>
				<div class="mt-1 flex flex-wrap items-center gap-1.5">
					{#if selectedIncident.year}
						<span class="rounded bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
							{selectedIncident.year}
						</span>
					{/if}
					{#if selectedIncident.cause}
						<span class="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
							{selectedIncident.cause}
						</span>
					{/if}
					{#if selectedIncident.agency}
						<span class="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
							{selectedIncident.agency}
						</span>
					{/if}
				</div>
			</div>
			<button
				class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors"
				onclick={close}
				aria-label="Close panel"
			>
				✕
			</button>
		</div>

		<!-- Scrollable body -->
		<div class="flex-1 overflow-y-auto px-5 py-4">

			<!-- Key stats grid -->
			<div class="grid grid-cols-2 gap-3">
				<div class="rounded-lg border border-gray-100 bg-gray-50 p-3">
					<div class="text-xs font-medium uppercase tracking-wide text-gray-400">Acres Burned</div>
					<div class="mt-1 text-2xl font-bold {acresSeverityClass(selectedIncident.acres).split(' ')[1]}">
						{formatAcres(selectedIncident.acres)}
					</div>
				</div>
				<div class="rounded-lg border border-gray-100 bg-gray-50 p-3">
					<div class="text-xs font-medium uppercase tracking-wide text-gray-400">Duration</div>
					<div class="mt-1 text-2xl font-bold text-gray-900">
						{formatDuration(selectedIncident.durationDays)}
					</div>
				</div>
				<div class="rounded-lg border border-gray-100 bg-gray-50 p-3">
					<div class="text-xs font-medium uppercase tracking-wide text-gray-400">CAL FIRE Unit</div>
					<div class="mt-1 text-lg font-semibold text-gray-900">{selectedIncident.unit}</div>
				</div>
				<div class="rounded-lg border border-gray-100 bg-gray-50 p-3">
					<div class="text-xs font-medium uppercase tracking-wide text-gray-400">Coordinates</div>
					<div class="mt-1 font-mono text-sm text-gray-700">
						{#if selectedIncident.lat != null}
							{selectedIncident.lat.toFixed(4)}, {selectedIncident.lng.toFixed(4)}
						{:else}
							—
						{/if}
					</div>
				</div>
			</div>

			<!-- Timeline bar -->
			{#if selectedIncident.startDate}
				<div class="mt-5">
					<div class="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Timeline</div>
					<div class="relative">
						<div class="h-2 w-full overflow-hidden rounded-full bg-gray-200">
							<div
								class="h-full rounded-full {acresSeverityClass(selectedIncident.acres)}"
								style="width: 100%"
							></div>
						</div>
						<div class="mt-1.5 flex justify-between text-xs text-gray-500">
							<span>{formatDate(selectedIncident.startDate)}</span>
							{#if selectedIncident.endDate}
								<span>{formatDate(selectedIncident.endDate)}</span>
							{:else}
								<span class="font-medium text-orange-600">Active</span>
							{/if}
						</div>
					</div>
				</div>
			{/if}

			<!-- Severity indicator -->
			<div class="mt-5">
				<div class="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Severity</div>
				<div class="flex items-center gap-2">
					<div class="flex-1 rounded-full {acresSeverityClass(selectedIncident.acres)} px-3 py-1.5 text-center text-sm font-semibold">
						{#if selectedIncident.acres == null}Unknown
						{:else if selectedIncident.acres >= 100_000}Extreme — {formatAcres(selectedIncident.acres)} acres
						{:else if selectedIncident.acres >= 10_000}Large — {formatAcres(selectedIncident.acres)} acres
						{:else if selectedIncident.acres >= 1_000}Moderate — {formatAcres(selectedIncident.acres)} acres
						{:else}Small — {formatAcres(selectedIncident.acres)} acres
						{/if}
					</div>
				</div>
			</div>

			<!-- Related fires in same unit -->
			{#if relatedFires.length > 0}
				<div class="mt-5">
					<div class="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
						Other fires in unit {selectedIncident.unit}
					</div>
					<div class="space-y-1">
						{#each relatedFires as fire}
							<button
								class="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
								onclick={() => uiState.update((state) => ({ ...state, selectedIncident: fire }))}
							>
								<span class="font-medium text-gray-700">{fire.name} FIRE</span>
								<div class="flex items-center gap-2 text-gray-400">
									<span>{fire.year}</span>
									<span class="text-xs {acresSeverityClass(fire.acres)} rounded px-1.5 py-0.5">
										{formatAcres(fire.acres)}
									</span>
								</div>
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
