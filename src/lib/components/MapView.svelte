<!-- Interactive Leaflet map showing filtered incidents as color-coded dots. -->
<!-- Dot color and size scale with acreage. Viewport fits the filtered set automatically. -->
<!-- Clicking a dot selects the incident, which will open the detail panel. -->

<script>
	import { onMount } from 'svelte';
	import { filteredIncidents, uiState } from '$lib/stores.js';
	import { ACRES_SMALL, ACRES_MEDIUM, ACRES_LARGE } from '$lib/constants.js';

	// The DOM node Leaflet will mount into — bound via bind:this below
	let mapContainer = $state(null);

	// Leaflet instance and the layer holding all incident markers
	let leafletMap = null;
	let markersLayer = null;

	// Dot color based on acres burned — mirrors the requirements doc color scale
	function getDotColor(acres) {
		if (acres == null)           return '#94a3b8'; // gray for unknown
		if (acres >= ACRES_LARGE)    return '#dc2626'; // red   — very large
		if (acres >= ACRES_MEDIUM)   return '#f97316'; // orange — large
		if (acres >= ACRES_SMALL)    return '#eab308'; // yellow — medium
		return '#22c55e';                               // green  — small
	}

	// Dot radius in pixels — log scale so massive fires don't dwarf everything else
	function getDotRadius(acres) {
		if (acres == null || acres <= 0) return 4;
		return Math.min(4 + Math.log10(acres) * 3, 24);
	}

	// Rebuild all markers whenever the filtered incident set changes.
	// $effect is Svelte 5's equivalent of Vue's watchEffect — it runs whenever
	// any reactive value it reads changes. Here it reads $filteredIncidents.
	$effect(() => {
		if (!leafletMap || !markersLayer) return;

		markersLayer.clearLayers();

		const incidentsWithCoordinates = $filteredIncidents.filter(
			(incident) => incident.lat != null && incident.lng != null
		);

		for (const incident of incidentsWithCoordinates) {
			const marker = window.L.circleMarker([incident.lat, incident.lng], {
				radius: getDotRadius(incident.acres),
				fillColor: getDotColor(incident.acres),
				color: '#fff',
				weight: 1,
				opacity: 0.9,
				fillOpacity: 0.75
			});

			marker.bindTooltip(
				`<strong>${incident.name}</strong><br>${incident.acres?.toLocaleString() ?? '?'} acres · ${incident.year ?? '?'}`,
				{ direction: 'top', offset: [0, -4] }
			);

			marker.on('click', () => {
				uiState.update((currentState) => ({ ...currentState, selectedIncident: incident }));
			});

			markersLayer.addLayer(marker);
		}

		// Zoom to fit the filtered set, or reset to full California view if nothing to show
		if (incidentsWithCoordinates.length > 0) {
			leafletMap.fitBounds(markersLayer.getBounds(), { padding: [24, 24], maxZoom: 10 });
		} else {
			leafletMap.setView([37.5, -119.5], 6);
		}
	});

	onMount(async () => {
		// Leaflet uses browser APIs so it can't run server-side — dynamic import ensures
		// it only loads in the browser. This is important for SvelteKit's static build.
		const leaflet = await import('leaflet');
		const L = leaflet.default;

		// Leaflet requires its CSS to render correctly
		await import('leaflet/dist/leaflet.css');

		leafletMap = L.map(mapContainer, { zoomControl: true }).setView([37.5, -119.5], 6);

		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '© OpenStreetMap contributors',
			maxZoom: 18
		}).addTo(leafletMap);

		markersLayer = L.layerGroup().addTo(leafletMap);

		// Expose L globally so the $effect above can reference it after mount
		window.L = L;

		// Cleanup — runs when the component is removed from the DOM.
		// Equivalent to Vue's onUnmounted(). Prevents memory leaks.
		return () => {
			leafletMap.remove();
			leafletMap = null;
			markersLayer = null;
		};
	});
</script>

<!-- The map container must have an explicit height for Leaflet to render -->
<div class="h-full w-full overflow-hidden rounded-lg border border-gray-200" bind:this={mapContainer}></div>

<svelte:head>
</svelte:head>
