<!-- Renders a single incident row. Highlights when selected. -->
<!-- Clicking the row selects the incident, opening the detail panel. -->

<script>
	import { uiState } from '$lib/stores.js';
	import { TABLE_COLUMNS } from '$lib/constants.js';
	import { formatColumnValue } from '$lib/utils.js';

	// $props() is how Svelte 5 receives props — equivalent to defineProps() in Vue 3.
	// We destructure incident directly out of the props object.
	let { incident } = $props();

	// $derived() recomputes automatically when its dependencies change —
	// equivalent to a computed() property in Vue.
	let isSelected = $derived($uiState.selectedIncident?.id === incident.id);

	// Density controls row padding — compact shows more rows, spacious gives breathing room
	let rowPaddingClass = $derived({
		compact:     'py-1 text-xs',
		comfortable: 'py-2 text-sm',
		spacious:    'py-4 text-sm'
	}[$uiState.density]);

	function selectIncident() {
		uiState.update((currentState) => ({ ...currentState, selectedIncident: incident }));
	}
</script>

<tr
	class="cursor-pointer border-b border-gray-100 transition-colors
		{isSelected
			? 'bg-orange-50 hover:bg-orange-100'
			: 'even:bg-gray-50 hover:bg-blue-50'}"
	onclick={selectIncident}
>
	{#each TABLE_COLUMNS as column}
		<td
			class="px-4 {rowPaddingClass} text-gray-700 whitespace-nowrap
				{column.frozen ? 'sticky left-0 z-10 bg-inherit shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]' : ''}"
		>
			{formatColumnValue(column.key, incident)}
		</td>
	{/each}
</tr>
