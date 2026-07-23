<!-- Methodology page — data pipeline, field mapping, and data quality. -->

<script>
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { base } from '$app/paths';
	import { incidents, loadingState } from '$lib/stores.js';
	import { fetchAllIncidents } from '$lib/api.js';

	const FIELD_MAPPINGS = [
		{ raw: 'OBJECTID',   normalized: 'id',           type: 'number', transformation: 'direct' },
		{ raw: 'FIRE_NAME',  normalized: 'name',         type: 'string', transformation: 'trimmed, defaults to "Unknown"' },
		{ raw: 'UNIT_ID',    normalized: 'unit',         type: 'string', transformation: 'direct, defaults to "Unknown"' },
		{ raw: 'AGENCY',     normalized: 'agency',       type: 'string', transformation: 'direct, nullable' },
		{ raw: 'YEAR_',      normalized: 'year',         type: 'number', transformation: 'direct, nullable' },
		{ raw: 'CAUSE',      normalized: 'cause',        type: 'string', transformation: 'decoded via 19-code lookup (CAL FIRE firestat.pdf)' },
		{ raw: 'GIS_ACRES',  normalized: 'acres',        type: 'number', transformation: 'rounded to integer, nullable' },
		{ raw: 'ALARM_DATE', normalized: 'startDate',    type: 'string', transformation: 'ms timestamp → ISO date string' },
		{ raw: 'CONT_DATE',  normalized: 'endDate',      type: 'string', transformation: 'ms timestamp → ISO date string' },
		{ raw: '(computed)', normalized: 'durationDays', type: 'number', transformation: '(endDate − startDate) in days, nullable' },
		{ raw: 'centroid.y', normalized: 'lat',          type: 'number', transformation: 'WGS84 latitude, nullable' },
		{ raw: 'centroid.x', normalized: 'lng',          type: 'number', transformation: 'WGS84 longitude, nullable' }
	];

	const PIPELINE_NODES = [
		{ title: 'ArcGIS FeatureServer',  subtitle: 'California Historic Fire Perimeters — paginated JSON API, 2,000 records per page' },
		{ title: 'src/lib/api.js',        subtitle: 'Paginates requests, normalizes raw ArcGIS fields into a clean incident model, stores result in Cache API' },
		{ title: 'Browser Cache API',     subtitle: 'Persists the full dataset across page refreshes — subsequent loads return instantly without hitting the network' },
		{ title: 'incidents store',       subtitle: 'Reactive Svelte writable store — all components read from here, never from the API directly' },
		{ title: 'src/lib/analytics.js', subtitle: 'Pure functions — derive metrics and projections client-side, no extra network calls' }
	];

	const TABS = [
		{ id: 'pipeline',      label: 'Pipeline' },
		{ id: 'field-mapping', label: 'Field Mapping' },
		{ id: 'data-quality',  label: 'Data Quality' }
	];

	let activeTab = $state('pipeline');
	let totalRecords = $state(0);
	let dateRange = $state('—');
	let percentUnknownCause = $state(0);
	let percentMissingAcres = $state(0);
	let isLoading = $state(false);
	let loadError = $state(null);

	onMount(() => {
		let destroyed = false;
		let cleanupLoadingState = () => {};
		let cleanupIncidents = () => {};

		(async () => {
			cleanupLoadingState = loadingState.subscribe((state) => {
				isLoading = state.status === 'loading';
				if (state.status === 'error') loadError = state.error;
				else loadError = null;
			});

			if (get(loadingState).status === 'idle') {
				loadingState.set({ status: 'loading', error: null });
				try {
					const allIncidentsData = await fetchAllIncidents();
					if (destroyed) return;
					incidents.set(allIncidentsData);
					loadingState.set({ status: 'success', error: null });
				} catch (fetchError) {
					if (!destroyed) loadingState.set({ status: 'error', error: fetchError.message });
				}
			}

			if (destroyed) return;

			cleanupIncidents = incidents.subscribe((allIncidentsData) => {
				if (allIncidentsData.length === 0) return;

				totalRecords = allIncidentsData.length;
				const years = allIncidentsData.map((incident) => incident.year).filter(Boolean).sort((a, b) => a - b);
				dateRange = years.length ? `${years[0]}–${years[years.length - 1]}` : '—';

				const unknownCauseCount = allIncidentsData.filter(
					(incident) => !incident.cause || incident.cause === 'Unknown'
				).length;
				percentUnknownCause = Math.round((unknownCauseCount / allIncidentsData.length) * 100);

				const missingAcresCount = allIncidentsData.filter((incident) => incident.acres == null).length;
				percentMissingAcres = Math.round((missingAcresCount / allIncidentsData.length) * 100);
			});
		})();

		return () => {
			destroyed = true;
			cleanupLoadingState();
			cleanupIncidents();
		};
	});
</script>

<div class="min-h-dvh bg-gray-50">

	<!-- Header -->
	<header class="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 shadow-sm sm:px-6">
		<div class="flex items-center gap-3">
			<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-orange-500">
				<span class="text-sm font-bold text-white">🔥</span>
			</div>
			<div>
				<span class="text-base font-bold text-gray-900 sm:text-lg">calfire-explorer</span>
				<span class="ml-2 text-sm text-gray-400">/ Methodology</span>
			</div>
		</div>
		<a href="{base}/" class="text-sm font-medium text-orange-600 transition-colors hover:text-orange-800">← Explorer</a>
	</header>

	<main class="mx-auto max-w-5xl px-4 py-10 sm:px-6">

		<!-- Tab bar -->
		<div class="mb-8 flex w-fit gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
			{#each TABS as tab}
				<button
					onclick={() => (activeTab = tab.id)}
					class="rounded-md px-4 py-1.5 text-sm font-medium transition-colors {activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
				>
					{tab.label}
				</button>
			{/each}
		</div>

		<!-- Pipeline tab -->
		{#if activeTab === 'pipeline'}
			<section>
				<h2 class="mb-1 text-xl font-bold text-gray-900">Data Pipeline</h2>
				<p class="mb-8 text-sm text-gray-500">How raw ArcGIS API data becomes the normalized incident model powering this app.</p>

				<div class="flex flex-col items-center gap-0">
					{#each PIPELINE_NODES as node, index}
						<div class="w-full max-w-lg rounded-lg border border-gray-200 bg-white px-5 py-3.5 shadow-sm">
							<div class="font-mono text-sm font-semibold text-orange-700">{node.title}</div>
							<div class="mt-0.5 text-xs text-gray-500">{node.subtitle}</div>
						</div>
						{#if index < PIPELINE_NODES.length - 1}
							<div class="my-1.5 text-lg text-gray-300">↓</div>
						{/if}
					{/each}
				</div>
			</section>

		<!-- Field Mapping tab -->
		{:else if activeTab === 'field-mapping'}
			<section>
				<h2 class="mb-1 text-xl font-bold text-gray-900">Field Mapping</h2>
				<p class="mb-6 text-sm text-gray-500">Every field in the normalized incident model, with its ArcGIS source and the transformation applied.</p>

				<div class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 bg-gray-50">
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Raw ArcGIS Field</th>
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Normalized Field</th>
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Type</th>
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Transformation</th>
							</tr>
						</thead>
						<tbody>
							{#each FIELD_MAPPINGS as row, index}
								<tr class="border-b border-gray-100 {row.raw === '(computed)' ? 'bg-blue-50' : index % 2 !== 0 ? 'bg-gray-50' : ''}">
									<td class="px-4 py-2.5 font-mono text-xs text-gray-700">{row.raw}</td>
									<td class="px-4 py-2.5 font-mono text-xs font-semibold text-orange-700">{row.normalized}</td>
									<td class="px-4 py-2.5 text-xs text-gray-500">{row.type}</td>
									<td class="px-4 py-2.5 text-xs text-gray-600">{row.transformation}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>

		<!-- Data Quality tab -->
		{:else if activeTab === 'data-quality'}
			<section>
				<h2 class="mb-1 text-xl font-bold text-gray-900">Data Quality</h2>
				<p class="mb-6 text-sm text-gray-500">Honest accounting of coverage and gaps in the source data.</p>

				{#if isLoading}
					<div class="flex items-center justify-center py-24">
						<div class="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500"></div>
					</div>
				{:else if loadError}
					<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
				{:else}
					<div class="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
						<div class="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
							<div class="text-xs font-medium uppercase tracking-wide text-gray-400">Total Records</div>
							<div class="mt-1 text-2xl font-bold text-gray-900">{totalRecords.toLocaleString()}</div>
						</div>
						<div class="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
							<div class="text-xs font-medium uppercase tracking-wide text-gray-400">Date Range</div>
							<div class="mt-1 text-xl font-bold text-gray-900">{dateRange}</div>
						</div>
						<div class="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
							<div class="text-xs font-medium uppercase tracking-wide text-gray-400">Unknown Cause</div>
							<div class="mt-1 text-2xl font-bold text-amber-600">{percentUnknownCause}%</div>
						</div>
						<div class="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
							<div class="text-xs font-medium uppercase tracking-wide text-gray-400">Missing Acres</div>
							<div class="mt-1 text-2xl font-bold text-amber-600">{percentMissingAcres}%</div>
						</div>
					</div>

					<p class="text-sm text-gray-500">
						Unknown causes and missing acreage are concentrated in older records. Prior to the 1980s, standardized cause
						reporting was not consistently enforced across all CAL FIRE units, and GIS perimeter geometry — from which
						<code class="rounded bg-gray-100 px-1 text-xs">GIS_ACRES</code> is derived — was not always captured for
						smaller or older fires.
					</p>
				{/if}
			</section>
		{/if}

	</main>
</div>
