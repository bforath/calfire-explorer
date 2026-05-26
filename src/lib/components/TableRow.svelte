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
		uiState.update((currentState) => ({
			...currentState,
			selectedIncident: currentState.selectedIncident?.id === incident.id ? null : incident
		}));
	}
</script>

<tr
	class="group cursor-pointer border-b border-gray-100 transition-colors
		{isSelected
			? 'bg-orange-50 hover:bg-orange-100 border-l-2 border-l-orange-500'
			: 'hover:bg-blue-50'}"
	onclick={selectIncident}
>
	{#each TABLE_COLUMNS as column}
		<td
			class="px-4 {rowPaddingClass} whitespace-nowrap
				{isSelected ? 'text-gray-900' : 'text-gray-700'}
				{column.frozen
					? `sticky left-0 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] ${isSelected ? 'bg-orange-50 group-hover:bg-orange-100' : 'bg-white group-hover:bg-blue-50'}`
					: ''}"
		>
			{#if column.frozen && isSelected}
				<span class="mr-1 text-orange-500">📍</span>
			{/if}
			{#if column.key === 'name'}
				<span class="rounded bg-gray-100 px-1.5 py-0.5 font-semibold text-gray-800 ring-1 ring-gray-200 ring-inset">
					{formatColumnValue(column.key, incident)}
				</span>
			{:else}
				{formatColumnValue(column.key, incident)}
			{/if}
		</td>
	{/each}
</tr>
