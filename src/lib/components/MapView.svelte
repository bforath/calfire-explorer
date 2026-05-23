<!-- Interactive Leaflet map showing filtered incidents as color-coded dots. -->
<!-- When an incident is selected, the map zooms to it and highlights the marker. -->

<script>
	import { onMount } from 'svelte';
	import { filteredIncidents, uiState } from '$lib/stores.js';
	import { ACRES_SMALL, ACRES_MEDIUM, ACRES_LARGE } from '$lib/constants.js';

	let mapContainer = $state(null);

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

	function rebuildMarkers(leafletMap, markersLayer, incidents) {
		markersLayer.clearLayers();

		const incidentsWithCoordinates = incidents.filter(
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

		if (incidentsWithCoordinates.length > 0) {
			leafletMap.fitBounds(markersLayer.getBounds(), { padding: [24, 24], maxZoom: 10 });
		} else {
			leafletMap.setView([37.5, -119.5], 6);
		}
	}

	function highlightSelectedIncident(leafletMap, markersLayer, selectedMarkerLayer, incident) {
		selectedMarkerLayer.clearLayers();

		if (!incident || incident.lat == null || incident.lng == null) {
			// No selection — show all dots again
			if (!leafletMap.hasLayer(markersLayer)) markersLayer.addTo(leafletMap);
			return;
		}

		// Hide all other dots so only the selected fire is visible on the map
		markersLayer.remove();

		window.L.circleMarker([incident.lat, incident.lng], {
			radius: getDotRadius(incident.acres) + 10,
			fillColor: 'transparent',
			color: getDotColor(incident.acres),
			weight: 3,
			opacity: 0.8,
			fillOpacity: 0,
			className: 'selected-incident-ring'
		}).addTo(selectedMarkerLayer);

		window.L.circleMarker([incident.lat, incident.lng], {
			radius: getDotRadius(incident.acres),
			fillColor: getDotColor(incident.acres),
			color: '#fff',
			weight: 2,
			opacity: 1,
			fillOpacity: 1
		}).addTo(selectedMarkerLayer);

		leafletMap.flyTo([incident.lat, incident.lng], 9, { duration: 0.8 });
	}

	onMount(async () => {
		const leaflet = await import('leaflet');
		const L = leaflet.default;
		await import('leaflet/dist/leaflet.css');
		window.L = L;

		const leafletMap = L.map(mapContainer).setView([37.5, -119.5], 6);

		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '© OpenStreetMap contributors',
			maxZoom: 18
		}).addTo(leafletMap);

		// featureGroup instead of layerGroup — featureGroup supports getBounds()
		// which we need to zoom the map to fit the filtered incident set
		const markersLayer = L.featureGroup().addTo(leafletMap);
		const selectedMarkerLayer = L.featureGroup().addTo(leafletMap);

		// Direct store subscriptions — these fire every time the store value changes,
		// with no dependency tracking complexity. Far more reliable for integrating
		// non-reactive third-party libraries like Leaflet.
		const unsubscribeFiltered = filteredIncidents.subscribe((currentFiltered) => {
			rebuildMarkers(leafletMap, markersLayer, currentFiltered);
		});

		const unsubscribeSelected = uiState.subscribe((currentState) => {
			highlightSelectedIncident(leafletMap, markersLayer, selectedMarkerLayer, currentState.selectedIncident);
		});

		return () => {
			unsubscribeFiltered();
			unsubscribeSelected();
			leafletMap.remove();
		};
	});
</script>

<div class="h-full w-full overflow-hidden rounded-lg border border-gray-200" bind:this={mapContainer}></div>

<style>
	:global(.selected-incident-ring) {
		animation: pulse-ring 1.5s ease-out infinite;
	}
	@keyframes pulse-ring {
		0%   { opacity: 0.8; transform: scale(1); }
		70%  { opacity: 0;   transform: scale(1.4); }
		100% { opacity: 0;   transform: scale(1.4); }
	}
</style>
