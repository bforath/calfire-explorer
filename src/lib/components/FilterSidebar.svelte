<!-- Collapsible filter sidebar. Slides in from the left and pushes the content area. -->
<!-- Contains a dual-handle year slider, size presets, cause pills, and unit search. -->

<script>
	import { incidents, filters } from '$lib/stores.js';
	import { uniqueValues, matchesFilters } from '$lib/utils.js';
	import { ACRES_SMALL, ACRES_MEDIUM, ACRES_LARGE } from '$lib/constants.js';

	let { onClose } = $props();

	let causeOptions = $derived(uniqueValues($incidents, 'cause'));
	let unitOptions  = $derived(uniqueValues($incidents, 'unit'));

	let dataYearMin = $derived(
		$incidents.length > 0
			? Math.min(...$incidents.map((incident) => incident.year).filter(Boolean))
			: 1950
	);
	let currentYear = new Date().getFullYear();

	let unitSearchQuery = $state('');

	let filteredUnitOptions = $derived(
		unitOptions.filter((unit) => {
			if (!availableUnits.has(unit) && !$filters.units.includes(unit)) return false;
			if (unitSearchQuery.trim() && !unit.toLowerCase().includes(unitSearchQuery.toLowerCase())) return false;
			return true;
		})
	);

	// Percentages used to position the orange fill between the two slider thumbs
	let yearMinPercent = $derived(
		((($filters.yearRange[0] - dataYearMin) / (currentYear - dataYearMin)) * 100)
	);
	let yearMaxRightPercent = $derived(
		((currentYear - $filters.yearRange[1]) / (currentYear - dataYearMin)) * 100
	);

	const SIZE_PRESETS = [
		{ label: 'Any',     acresRange: [0, Infinity],              description: null },
		{ label: 'Small',   acresRange: [0, ACRES_SMALL - 1],       description: '< 1K ac' },
		{ label: 'Medium',  acresRange: [ACRES_SMALL, ACRES_MEDIUM - 1],  description: '1K–10K' },
		{ label: 'Large',   acresRange: [ACRES_MEDIUM, ACRES_LARGE - 1],  description: '10K–100K' },
		{ label: 'Extreme', acresRange: [ACRES_LARGE, Infinity],    description: '100K+' }
	];

	let activeSizePresetIndex = $derived(
		SIZE_PRESETS.findIndex(
			(preset) =>
				preset.acresRange[0] === $filters.acresRange[0] &&
				preset.acresRange[1] === $filters.acresRange[1]
		)
	);

	// Which causes have at least one incident that matches all other active filters.
	// Ignores the cause filter itself so selecting one cause doesn't grey out all others.
	let availableCauses = $derived(
		new Set(
			$incidents
				.filter((incident) => matchesFilters(incident, { ...$filters, causes: [] }))
				.map((incident) => incident.cause)
		)
	);

	// Same logic for units — ignores the unit filter when computing availability.
	let availableUnits = $derived(
		new Set(
			$incidents
				.filter((incident) => matchesFilters(incident, { ...$filters, units: [] }))
				.map((incident) => incident.unit)
		)
	);

	let activeFilterCount = $derived(
		($filters.units.length > 0 ? 1 : 0) +
		($filters.causes.length > 0 ? 1 : 0) +
		($filters.acresRange[0] > 0 || $filters.acresRange[1] !== Infinity ? 1 : 0) +
		($filters.yearRange[0] > dataYearMin || $filters.yearRange[1] < currentYear ? 1 : 0)
	);

	function updateYearMin(event) {
		const value = Math.min(Number(event.target.value), $filters.yearRange[1]);
		filters.update((currentFilters) => ({ ...currentFilters, yearRange: [value, currentFilters.yearRange[1]] }));
	}

	function updateYearMax(event) {
		const value = Math.max(Number(event.target.value), $filters.yearRange[0]);
		filters.update((currentFilters) => ({ ...currentFilters, yearRange: [currentFilters.yearRange[0], value] }));
	}

	function setSizePreset(preset) {
		filters.update((currentFilters) => ({ ...currentFilters, acresRange: preset.acresRange }));
	}

	function toggleCause(cause) {
		filters.update((currentFilters) => ({
			...currentFilters,
			causes: currentFilters.causes.includes(cause)
				? currentFilters.causes.filter((existingCause) => existingCause !== cause)
				: [...currentFilters.causes, cause]
		}));
	}

	function toggleUnit(unit) {
		filters.update((currentFilters) => ({
			...currentFilters,
			units: currentFilters.units.includes(unit)
				? currentFilters.units.filter((existingUnit) => existingUnit !== unit)
				: [...currentFilters.units, unit]
		}));
	}

	function clearAllFilters() {
		filters.set({
			units: [],
			yearRange: [dataYearMin, currentYear],
			causes: [],
			acresRange: [0, Infinity],
			search: ''
		});
	}
</script>

<aside class="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
	<!-- Header -->
	<div class="flex flex-shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
		<span class="text-sm font-semibold text-gray-800">Filters</span>
		<div class="flex items-center gap-2">
			{#if activeFilterCount > 0}
				<button
					class="text-xs text-orange-600 transition-colors hover:text-orange-800"
					onclick={clearAllFilters}
				>
					Clear all
				</button>
			{/if}
			<button
				class="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
				onclick={onClose}
			>
				✕
			</button>
		</div>
	</div>

	<!-- Scrollable filter sections -->
	<div class="flex flex-col gap-6 overflow-y-auto p-4">

		<!-- Year range -->
		<section>
			<div class="mb-3 flex items-center justify-between">
				<span class="text-xs font-semibold uppercase tracking-wide text-gray-500">Year</span>
				<span class="text-xs tabular-nums text-gray-500">
					{$filters.yearRange[0]} – {$filters.yearRange[1]}
				</span>
			</div>
			<div class="year-slider-wrapper">
				<div class="track">
					<div
						class="track-fill"
						style="left: {yearMinPercent}%; right: {yearMaxRightPercent}%"
					></div>
				</div>
				<input
					type="range"
					class="range-thumb"
					min={dataYearMin}
					max={currentYear}
					value={$filters.yearRange[0]}
					oninput={updateYearMin}
				/>
				<input
					type="range"
					class="range-thumb"
					min={dataYearMin}
					max={currentYear}
					value={$filters.yearRange[1]}
					oninput={updateYearMax}
				/>
			</div>
			<div class="mt-1.5 flex justify-between text-xs text-gray-400">
				<span>{dataYearMin}</span>
				<span>{currentYear}</span>
			</div>
		</section>

		<!-- Fire size presets -->
		<section>
			<div class="mb-3">
				<span class="text-xs font-semibold uppercase tracking-wide text-gray-500">Fire Size</span>
			</div>
			<div class="flex flex-wrap gap-1.5">
				{#each SIZE_PRESETS as preset, index}
					<button
						onclick={() => setSizePreset(preset)}
						class="rounded-full border px-2.5 py-1 text-xs transition-colors
							{activeSizePresetIndex === index
								? 'border-orange-400 bg-orange-50 font-medium text-orange-700'
								: 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'}"
					>
						{preset.label}
						{#if preset.description}
							<span class="ml-0.5 opacity-60">{preset.description}</span>
						{/if}
					</button>
				{/each}
			</div>
		</section>

		<!-- Cause pills -->
		<section>
			<div class="mb-3 flex items-center justify-between">
				<span class="text-xs font-semibold uppercase tracking-wide text-gray-500">Cause</span>
				{#if $filters.causes.length > 0}
					<button
						class="text-xs text-orange-600 transition-colors hover:text-orange-800"
						onclick={() => filters.update((currentFilters) => ({ ...currentFilters, causes: [] }))}
					>
						Clear
					</button>
				{/if}
			</div>
			<div class="flex flex-wrap gap-1.5">
				{#each causeOptions as cause}
					{@const isSelected = $filters.causes.includes(cause)}
					{@const isAvailable = availableCauses.has(cause)}
					<button
						onclick={() => toggleCause(cause)}
						disabled={!isSelected && !isAvailable}
						class="rounded-full border px-2.5 py-1 text-xs transition-colors
							{isSelected
								? 'border-orange-400 bg-orange-50 font-medium text-orange-700'
								: isAvailable
									? 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
									: 'cursor-default border-gray-100 bg-gray-50 text-gray-300'}"
					>
						{cause}
					</button>
				{/each}
			</div>
		</section>

		<!-- Unit search + list -->
		<section>
			<div class="mb-3 flex items-center justify-between">
				<span class="text-xs font-semibold uppercase tracking-wide text-gray-500">Unit</span>
				{#if $filters.units.length > 0}
					<button
						class="text-xs text-orange-600 transition-colors hover:text-orange-800"
						onclick={() => filters.update((currentFilters) => ({ ...currentFilters, units: [] }))}
					>
						Clear ({$filters.units.length})
					</button>
				{/if}
			</div>
			<input
				bind:value={unitSearchQuery}
				type="text"
				placeholder="Search units..."
				class="mb-2 w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 placeholder-gray-400 focus:border-orange-400 focus:outline-none"
			/>
			<div class="max-h-44 overflow-y-auto rounded-md border border-gray-100">
				{#each filteredUnitOptions as unit}
					<label
						class="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm transition-colors
							{$filters.units.includes(unit) ? 'bg-orange-50 text-orange-800' : 'text-gray-700 hover:bg-gray-50'}"
					>
						<input
							type="checkbox"
							class="accent-orange-500"
							checked={$filters.units.includes(unit)}
							onchange={() => toggleUnit(unit)}
						/>
						{unit}
					</label>
				{:else}
					<p class="px-3 py-2 text-sm text-gray-400">No units match</p>
				{/each}
			</div>
		</section>

	</div>
</aside>

<style>
	.year-slider-wrapper {
		position: relative;
		height: 20px;
	}
	.track {
		position: absolute;
		top: 50%;
		left: 0;
		right: 0;
		height: 4px;
		border-radius: 2px;
		background: #e5e7eb;
		transform: translateY(-50%);
		pointer-events: none;
	}
	.track-fill {
		position: absolute;
		top: 0;
		bottom: 0;
		border-radius: 2px;
		background: #f97316;
	}
	.range-thumb {
		position: absolute;
		width: 100%;
		height: 100%;
		appearance: none;
		-webkit-appearance: none;
		background: transparent;
		pointer-events: none;
		outline: none;
	}
	.range-thumb::-webkit-slider-thumb {
		appearance: none;
		-webkit-appearance: none;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: white;
		border: 2px solid #f97316;
		cursor: grab;
		pointer-events: all;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
	}
	.range-thumb::-moz-range-thumb {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: white;
		border: 2px solid #f97316;
		cursor: grab;
		pointer-events: all;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
		border-style: solid;
	}
	.range-thumb:active::-webkit-slider-thumb {
		cursor: grabbing;
	}
</style>
