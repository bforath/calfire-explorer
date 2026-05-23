<!-- Spotlight-style floating search overlay. -->
<!-- Opens on cmd+K (Mac) or ctrl+K (Windows/Linux), or shift+shift. -->
<!-- Searches incident name, unit, cause, and year simultaneously. -->

<script>
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { incidents, uiState } from '$lib/stores.js';
	import { formatAcres, formatDate } from '$lib/utils.js';

	let isOpen = $state(false);
	let searchQuery = $state('');
	let inputElement = $state(null);
	let lastKeyTime = 0; // used for shift+shift detection

	// Search results — computed from the full incident set, not the filtered set,
	// so you can search for things currently hidden by filters
	let searchResults = $derived(() => {
		const trimmedQuery = searchQuery.trim().toLowerCase();
		if (!trimmedQuery) return [];

		return $incidents
			.filter((incident) => {
				const searchableText = [
					incident.name,
					incident.unit,
					incident.cause,
					String(incident.year ?? '')
				]
					.join(' ')
					.toLowerCase();
				return searchableText.includes(trimmedQuery);
			})
			.slice(0, 8); // show at most 8 results to keep the overlay compact
	});

	let results = $derived(searchResults());

	function open() {
		isOpen = true;
		searchQuery = '';
		// Focus the input after Svelte renders the element into the DOM
		setTimeout(() => inputElement?.focus(), 0);
	}

	function close() {
		isOpen = false;
		searchQuery = '';
	}

	function selectResult(incident) {
		uiState.update((currentState) => ({ ...currentState, selectedIncident: incident }));
		close();
	}

	function handleWindowKeydown(event) {
		// cmd+K on Mac, ctrl+K on Windows/Linux
		if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
			event.preventDefault();
			isOpen ? close() : open();
			return;
		}

		// shift+shift — two shift presses within 400ms
		if (event.key === 'Shift') {
			const now = Date.now();
			if (now - lastKeyTime < 400) {
				event.preventDefault();
				isOpen ? close() : open();
				lastKeyTime = 0;
			} else {
				lastKeyTime = now;
			}
			return;
		}

		if (event.key === 'Escape' && isOpen) {
			close();
		}
	}

	function acresBadgeClass(acres) {
		if (acres == null)      return 'bg-gray-100 text-gray-500';
		if (acres >= 100_000)   return 'bg-red-100 text-red-700';
		if (acres >= 10_000)    return 'bg-orange-100 text-orange-700';
		if (acres >= 1_000)     return 'bg-yellow-100 text-yellow-700';
		return                         'bg-green-100 text-green-700';
	}
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if isOpen}
	<!-- Full-screen backdrop -->
	<div
		class="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4"
		transition:fade={{ duration: 150 }}
	>
		<!-- Click backdrop to close -->
		<div class="absolute inset-0 bg-black/40" onclick={close} role="presentation"></div>

		<!-- Search panel -->
		<div
			class="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
			transition:fly={{ y: -20, duration: 200, easing: cubicOut }}
		>
			<!-- Input row -->
			<div class="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
				<span class="text-gray-400">🔍</span>
				<input
					bind:this={inputElement}
					bind:value={searchQuery}
					class="flex-1 bg-transparent text-base text-gray-900 placeholder-gray-400 outline-none"
					placeholder="Search incidents by name, unit, or cause..."
					type="text"
				/>
				<kbd class="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
					esc
				</kbd>
			</div>

			<!-- Results list -->
			{#if searchQuery.trim()}
				{#if results.length > 0}
					<ul class="max-h-80 overflow-y-auto py-1">
						{#each results as incident}
							<li>
								<button
									class="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
									onclick={() => selectResult(incident)}
								>
									<div>
										<span class="font-medium text-gray-900">{incident.name} FIRE</span>
										<div class="mt-0.5 text-xs text-gray-400">
											{incident.unit} · {incident.cause} · {formatDate(incident.startDate)}
										</div>
									</div>
									<span class="ml-3 flex-shrink-0 rounded px-2 py-0.5 text-xs font-medium {acresBadgeClass(incident.acres)}">
										{formatAcres(incident.acres)}
									</span>
								</button>
							</li>
						{/each}
					</ul>
				{:else}
					<div class="px-4 py-8 text-center text-sm text-gray-400">
						No incidents found for "{searchQuery}"
					</div>
				{/if}
			{:else}
				<div class="px-4 py-6 text-center text-sm text-gray-400">
					Start typing to search across all 23,000+ incidents
				</div>
			{/if}

			<!-- Footer hint -->
			<div class="border-t border-gray-100 px-4 py-2 text-xs text-gray-400 flex gap-3">
				<span><kbd class="rounded border border-gray-200 bg-gray-100 px-1 text-gray-500">↵</kbd> to select</span>
				<span><kbd class="rounded border border-gray-200 bg-gray-100 px-1 text-gray-500">esc</kbd> to close</span>
				<span class="ml-auto">cmd+K to reopen</span>
			</div>
		</div>
	</div>
{/if}
