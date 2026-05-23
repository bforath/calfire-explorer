<!-- Pagination controls: rows-per-page selector, page count, and prev/next buttons. -->
<!-- Reads current page state from uiState store and updates it on interaction. -->

<script>
	import { uiState } from '$lib/stores.js';
	import { ROWS_PER_PAGE_OPTIONS } from '$lib/constants.js';

	let { total } = $props();

	let totalPages      = $derived(Math.max(1, Math.ceil(total / $uiState.rowsPerPage)));
	let firstRowNumber  = $derived(total === 0 ? 0 : ($uiState.currentPage - 1) * $uiState.rowsPerPage + 1);
	let lastRowNumber   = $derived(Math.min($uiState.currentPage * $uiState.rowsPerPage, total));

	function goToPage(pageNumber) {
		uiState.update((currentState) => ({ ...currentState, currentPage: pageNumber }));
	}

	function handleRowsPerPageChange(event) {
		uiState.update((currentState) => ({
			...currentState,
			rowsPerPage: Number(event.target.value),
			currentPage: 1 // reset to first page so we don't land on a page that no longer exists
		}));
	}
</script>

<div class="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
	<!-- Left: row count summary -->
	<div class="flex items-center gap-3">
		<span>
			{#if total === 0}
				No incidents found
			{:else}
				Showing {firstRowNumber}–{lastRowNumber} of {total.toLocaleString()} incidents
			{/if}
		</span>

		<label class="flex items-center gap-1.5 text-gray-500">
			Rows per page:
			<select
				class="rounded border border-gray-300 px-1.5 py-0.5 text-sm text-gray-700"
				value={$uiState.rowsPerPage}
				onchange={handleRowsPerPageChange}
			>
				{#each ROWS_PER_PAGE_OPTIONS as option}
					<option value={option}>{option}</option>
				{/each}
			</select>
		</label>
	</div>

	<!-- Right: page navigation -->
	<div class="flex items-center gap-1">
		<button
			class="rounded px-2 py-1 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
			disabled={$uiState.currentPage === 1}
			onclick={() => goToPage($uiState.currentPage - 1)}
		>
			←
		</button>

		<span class="px-2">Page {$uiState.currentPage} of {totalPages}</span>

		<button
			class="rounded px-2 py-1 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
			disabled={$uiState.currentPage === totalPages}
			onclick={() => goToPage($uiState.currentPage + 1)}
		>
			→
		</button>
	</div>
</div>
