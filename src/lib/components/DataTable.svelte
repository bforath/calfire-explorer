<!-- Assembles the full data table: sticky header, scrollable body, and pagination bar. -->
<!-- Reads incident data from stores — no props needed. -->

<script>
	import { paginatedIncidents, filteredIncidents } from '$lib/stores.js';
	import { TABLE_COLUMNS } from '$lib/constants.js';
	import TableHeader from './TableHeader.svelte';
	import TableRow from './TableRow.svelte';
	import Pagination from './Pagination.svelte';
</script>

<div class="flex h-72 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white md:h-full">
	<!-- Scrollable table area — header stays sticky within this container -->
	<div class="overflow-auto flex-1">
		<table class="w-full border-collapse">
			<TableHeader />
			<tbody>
				<!-- {#each} is the Svelte equivalent of v-for.                          -->
				<!-- The (incident.id) in parentheses is the key — same as :key in Vue. -->
				<!-- It helps Svelte efficiently update only the rows that changed.      -->
				{#each $paginatedIncidents as incident (incident.id)}
					<TableRow {incident} />
				{:else}
					<!-- {:else} on an {#each} block renders when the array is empty —   -->
					<!-- there's no separate v-empty in Svelte, this handles it inline.  -->
					<tr>
						<td colspan={TABLE_COLUMNS.length} class="py-16 text-center text-gray-400">
							<p class="text-base">No incidents match your current filters.</p>
							<p class="mt-1 text-sm">Try removing a filter to see more results.</p>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<Pagination total={$filteredIncidents.length} />
</div>
