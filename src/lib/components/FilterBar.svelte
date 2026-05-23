<!-- Filter controls for unit, year range, cause, and acreage. -->
<!-- Reads available options from the incidents store and writes selections to filters store. -->

<script>
	import { incidents, filters } from '$lib/stores.js';
	import { uniqueValues } from '$lib/utils.js';
	import MultiSelectDropdown from './MultiSelectDropdown.svelte';

	// Derive available options from the full incident set (not filtered)
	// so options never disappear while filtering — that would be confusing.
	let unitOptions  = $derived(uniqueValues($incidents, 'unit'));
	let causeOptions = $derived(uniqueValues($incidents, 'cause'));
	let dataYearMin  = $derived(
		$incidents.length > 0
			? Math.min(...$incidents.map((incident) => incident.year).filter(Boolean))
			: 1950
	);

	// Count how many filter categories have active selections (for the "Clear all" badge)
	let activeFilterCount = $derived(
		($filters.units.length > 0 ? 1 : 0) +
		($filters.causes.length > 0 ? 1 : 0) +
		($filters.acresRange[0] > 0 || $filters.acresRange[1] !== Infinity ? 1 : 0) +
		($filters.yearRange[0] > dataYearMin || $filters.yearRange[1] < new Date().getFullYear() ? 1 : 0)
	);

	function updateUnits(selected) {
		filters.update((currentFilters) => ({ ...currentFilters, units: selected }));
	}

	function updateCauses(selected) {
		filters.update((currentFilters) => ({ ...currentFilters, causes: selected }));
	}

	function updateYearMin(event) {
		const value = Number(event.target.value);
		filters.update((currentFilters) => ({
			...currentFilters,
			yearRange: [value, currentFilters.yearRange[1]]
		}));
	}

	function updateYearMax(event) {
		const value = Number(event.target.value);
		filters.update((currentFilters) => ({
			...currentFilters,
			yearRange: [currentFilters.yearRange[0], value]
		}));
	}

	function updateAcresMin(event) {
		const value = event.target.value === '' ? 0 : Number(event.target.value);
		filters.update((currentFilters) => ({
			...currentFilters,
			acresRange: [value, currentFilters.acresRange[1]]
		}));
	}

	function updateAcresMax(event) {
		const value = event.target.value === '' ? Infinity : Number(event.target.value);
		filters.update((currentFilters) => ({
			...currentFilters,
			acresRange: [currentFilters.acresRange[0], value]
		}));
	}

	function clearAllFilters() {
		filters.set({
			units: [],
			yearRange: [dataYearMin, new Date().getFullYear()],
			causes: [],
			acresRange: [0, Infinity],
			search: ''
		});
	}

	const inputClass = 'w-20 rounded border border-gray-300 px-2 py-1 text-sm text-gray-700 focus:border-orange-400 focus:outline-none';
</script>

<div class="flex flex-wrap items-center gap-2">
	<MultiSelectDropdown
		label="Unit"
		options={unitOptions}
		selected={$filters.units}
		onSelectionChange={updateUnits}
	/>

	<!-- Year range — two number inputs side by side -->
	<div class="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700">
		<span class="text-gray-500">Year</span>
		<input
			type="number"
			class={inputClass}
			value={$filters.yearRange[0]}
			min={dataYearMin}
			max={$filters.yearRange[1]}
			onchange={updateYearMin}
		/>
		<span class="text-gray-400">–</span>
		<input
			type="number"
			class={inputClass}
			value={$filters.yearRange[1]}
			min={$filters.yearRange[0]}
			max={new Date().getFullYear()}
			onchange={updateYearMax}
		/>
	</div>

	<MultiSelectDropdown
		label="Cause"
		options={causeOptions}
		selected={$filters.causes}
		onSelectionChange={updateCauses}
	/>

	<!-- Acres range — two number inputs -->
	<div class="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700">
		<span class="text-gray-500">Acres</span>
		<input
			type="number"
			class={inputClass}
			placeholder="Min"
			value={$filters.acresRange[0] > 0 ? $filters.acresRange[0] : ''}
			min="0"
			onchange={updateAcresMin}
		/>
		<span class="text-gray-400">–</span>
		<input
			type="number"
			class={inputClass}
			placeholder="Max"
			value={$filters.acresRange[1] !== Infinity ? $filters.acresRange[1] : ''}
			min="0"
			onchange={updateAcresMax}
		/>
	</div>

	{#if activeFilterCount > 0}
		<button
			class="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-600 hover:bg-red-100 transition-colors"
			onclick={clearAllFilters}
		>
			Clear filters
			<span class="rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-semibold text-white">
				{activeFilterCount}
			</span>
		</button>
	{/if}
</div>
