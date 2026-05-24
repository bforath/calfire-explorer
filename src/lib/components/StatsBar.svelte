<!-- Displays five summary statistics for the currently filtered set of incidents. -->
<!-- This component is entirely read-only — it only consumes the summaryStats store. -->

<script>
	import { summaryStats } from '$lib/stores.js';
	import { formatAcres } from '$lib/utils.js';

	// Each stat card is defined as data so the template stays clean and consistent.
	// $derived recomputes this array whenever summaryStats changes.
	let statCards = $derived([
		{
			value: $summaryStats.count.toLocaleString(),
			label: 'incidents'
		},
		{
			value: formatAcres($summaryStats.totalAcres),
			label: 'total acres'
		},
		{
			value: $summaryStats.unitsAffected.toLocaleString(),
			label: 'units affected'
		},
		{
			value: $summaryStats.peakYear ?? '—',
			label: 'peak year'
		},
		{
			value: $summaryStats.mostActiveUnit ?? '—',
			label: 'most active unit'
		}
	]);
</script>

<div class="overflow-x-auto rounded-lg border border-gray-200 bg-white">
	<div class="grid min-w-max grid-cols-5 divide-x divide-gray-200">
		{#each statCards as card}
			<div class="px-3 py-2.5 sm:px-4 sm:py-3">
				<div class="text-base font-bold text-gray-900 sm:text-xl">{card.value}</div>
				<div class="mt-0.5 text-xs text-gray-500">{card.label}</div>
			</div>
		{/each}
	</div>
</div>
