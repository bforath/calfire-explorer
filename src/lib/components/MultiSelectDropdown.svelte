<!-- A dropdown button that opens a list of checkboxes for multi-select filtering. -->
<!-- Closes when clicking outside — uses a Svelte action for that behavior. -->

<script>
	// $props() with defaults — equivalent to defineProps() with defaults in Vue 3.
	let { label, options, selected, onSelectionChange } = $props();

	let isOpen = $state(false);

	let badgeCount = $derived(selected.length);

	function toggleOption(option) {
		const updatedSelection = selected.includes(option)
			? selected.filter((currentOption) => currentOption !== option)
			: [...selected, option];
		onSelectionChange(updatedSelection);
	}

	function clearSelection() {
		onSelectionChange([]);
	}

	// Svelte action — a function that receives a DOM node and sets up behavior on it.
	// This is equivalent to Vue's custom directives (v-click-outside).
	// The returned { destroy } function runs when the element is removed from the DOM,
	// which is how we clean up the event listener automatically.
	function closeWhenClickedOutside(node) {
		function handleDocumentClick(event) {
			if (!node.contains(event.target)) {
				isOpen = false;
			}
		}
		document.addEventListener('click', handleDocumentClick, true);
		return {
			destroy() {
				document.removeEventListener('click', handleDocumentClick, true);
			}
		};
	}
</script>

<!-- use:closeWhenClickedOutside attaches the action to this div -->
<div class="relative" use:closeWhenClickedOutside>
	<button
		class="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors
			{isOpen
				? 'border-orange-400 bg-orange-50 text-orange-700'
				: 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'}"
		onclick={() => (isOpen = !isOpen)}
	>
		{label}
		{#if badgeCount > 0}
			<span class="rounded-full bg-orange-500 px-1.5 py-0.5 text-xs font-semibold text-white">
				{badgeCount}
			</span>
		{/if}
		<span class="text-gray-400">{isOpen ? '▲' : '▼'}</span>
	</button>

	{#if isOpen}
		<div class="absolute left-0 top-full z-30 mt-1 max-h-64 w-56 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
			{#if selected.length > 0}
				<button
					class="w-full px-3 py-2 text-left text-xs text-orange-600 hover:bg-orange-50 border-b border-gray-100"
					onclick={clearSelection}
				>
					Clear selection ({selected.length})
				</button>
			{/if}

			{#each options as option}
				<label class="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50">
					<input
						type="checkbox"
						class="accent-orange-500"
						checked={selected.includes(option)}
						onchange={() => toggleOption(option)}
					/>
					{option}
				</label>
			{:else}
				<p class="px-3 py-2 text-sm text-gray-400">No options available</p>
			{/each}
		</div>
	{/if}
</div>
