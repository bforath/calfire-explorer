<!-- Interactive Leaflet map showing filtered incidents as color-coded dots. -->
<!-- When an incident is selected, the map zooms to it and highlights the marker. -->

<script>
	import { onMount } from 'svelte';
	import { filteredIncidents, uiState } from '$lib/stores.js';
	import { ACRES_SMALL, ACRES_MEDIUM, ACRES_LARGE } from '$lib/constants.js';

	let mapContainer = $state(null);
	let leafletMap = $state(null);
	let markersLayer = $state(null);
	let selectedMarkerLayer = $state(null);

	function getDotColor(acres) {
		if (acres == null)         return '#94a3b8';
		if (acres >= ACRES_LARGE)  return '#dc2626';
		if (acres >= ACRES_MEDIUM) return '#f97316';
		if (acres >= ACRES_SMALL)  return '#eab308';
		return '#22c55e';
	}

	function getDotRadius(acres) {
		if (acres == null || acres <= 0) return 4;
		return Math.min(4 + Math.log10(acres) * 3, 24);
	}

	// Rebuild all markers whenever the filtered set changes
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

		// Zoom to fit the filtered set every time filters change
		if (incidentsWithCoordinates.length > 0) {
			leafletMap.fitBounds(markersLayer.getBounds(), { padding: [24, 24], maxZoom: 10 });
		} else {
			leafletMap.setView([37.5, -119.5], 6);
		}
	});

	// When the selected incident changes, zoom to it and show a pulsing highlight ring
	$effect(() => {
		if (!leafletMap || !selectedMarkerLayer) return;

		selectedMarkerLayer.clearLayers();
		const incident = $uiState.selectedIncident;

		if (!incident || incident.lat == null || incident.lng == null) return;

		// Outer pulsing ring — larger, semi-transparent circle to draw the eye
		window.L.circleMarker([incident.lat, incident.lng], {
			radius: getDotRadius(incident.acres) + 10,
			fillColor: 'transparent',
			color: getDotColor(incident.acres),
			weight: 3,
			opacity: 0.8,
			fillOpacity: 0,
			className: 'selected-incident-ring'
		}).addTo(selectedMarkerLayer);

		// Solid center dot on top
		window.L.circleMarker([incident.lat, incident.lng], {
			radius: getDotRadius(incident.acres),
			fillColor: getDotColor(incident.acres),
			color: '#fff',
			weight: 2,
			opacity: 1,
			fillOpacity: 1
		}).addTo(selectedMarkerLayer);

		leafletMap.flyTo([incident.lat, incident.lng], 9, { duration: 0.8 });
	});

	onMount(async () => {
		const leaflet = await import('leaflet');
		const L = leaflet.default;
		await import('leaflet/dist/leaflet.css');

		leafletMap = L.map(mapContainer, { zoomControl: true }).setView([37.5, -119.5], 6);

		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '© OpenStreetMap contributors',
			maxZoom: 18
		}).addTo(leafletMap);

		markersLayer = L.layerGroup().addTo(leafletMap);
		selectedMarkerLayer = L.layerGroup().addTo(leafletMap); // always on top

		window.L = L;

		return () => {
			leafletMap?.remove();
			leafletMap = null;        // $state assignment — clears the effects
			markersLayer = null;
			selectedMarkerLayer = null;
		};
	});
</script>

<div class="h-full w-full overflow-hidden rounded-lg border border-gray-200" bind:this={mapContainer}></div>

<style>
	/* Pulse animation on the selected incident ring */
	:global(.selected-incident-ring) {
		animation: pulse-ring 1.5s ease-out infinite;
	}
	@keyframes pulse-ring {
		0%   { opacity: 0.8; transform: scale(1); }
		70%  { opacity: 0;   transform: scale(1.4); }
		100% { opacity: 0;   transform: scale(1.4); }
	}
</style>
