<!-- Renders the sticky header row with sortable column buttons. -->
<!-- Clicking a column header toggles sort direction or sets a new sort column. -->

<script>
	import { uiState } from '$lib/stores.js';
	import { TABLE_COLUMNS } from '$lib/constants.js';

	// When a column header is clicked, either flip the direction (if already
	// sorting by that column) or switch to the new column sorted ascending.
	function handleSortClick(columnKey) {
		uiState.update((currentState) => {
			const isAlreadySortedByThisColumn = currentState.sortColumn === columnKey;
			return {
				...currentState,
				sortColumn: columnKey,
				sortDirection: isAlreadySortedByThisColumn
					? (currentState.sortDirection === 'asc' ? 'desc' : 'asc')
					: 'asc'
			};
		});
	}
</script>

<thead class="sticky top-0 z-10 border-b border-gray-200">
	<tr>
		{#each TABLE_COLUMNS as column}
			<th
				class="bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap
					{column.frozen ? 'sticky left-0 z-20' : ''}"
			>
				{#if column.sortable}
					<button
						class="flex items-center gap-1 hover:text-gray-900 transition-colors"
						onclick={() => handleSortClick(column.key)}
					>
						{column.label}
						<span class="w-3 text-gray-400">
							{#if $uiState.sortColumn === column.key}
								{$uiState.sortDirection === 'asc' ? '↑' : '↓'}
							{/if}
						</span>
					</button>
				{:else}
					{column.label}
				{/if}
			</th>
		{/each}
	</tr>
</thead>
