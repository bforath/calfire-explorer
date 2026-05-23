<!-- Renders a single incident row. Highlights when selected and zooms the map to that fire. -->

<script>
	import { uiState } from '$lib/stores.js';
	import { TABLE_COLUMNS } from '$lib/constants.js';
	import { formatColumnValue } from '$lib/utils.js';

	let { incident } = $props();

	let isSelected = $derived($uiState.selectedIncident?.id === incident.id);

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
			? 'bg-orange-50 hover:bg-orange-100 border-l-2 border-l-orange-500'
			: 'hover:bg-blue-50'}"
	onclick={selectIncident}
>
	{#each TABLE_COLUMNS as column}
		<td
			class="px-4 {rowPaddingClass} whitespace-nowrap
				{isSelected ? 'text-gray-900' : 'text-gray-700'}
				{column.frozen ? 'sticky left-0 z-10 bg-inherit shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]' : ''}"
		>
			{#if column.frozen && isSelected}
				<span class="mr-1 text-orange-500">📍</span>
			{/if}
			{formatColumnValue(column.key, incident)}
		</td>
	{/each}
</tr>
