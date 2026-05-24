# calfire-explorer

An interactive data explorer for California wildfire incident history, built with SvelteKit. Browse, filter, and analyze 23,000+ fire records dating back to 1950 — sourced live from the CAL FIRE ArcGIS FeatureServer.

**[Live demo →](https://bforath.github.io/calfire-explorer)**

> **Note:** Mobile layout is a work in progress. The core explorer is functional on phones but some views and interactions are optimized for desktop.

---

## Features

### Explorer
- **Incident table** — sortable by name, unit, year, cause, acres burned, duration, and start date. Adjustable row density and pagination.
- **Interactive map** — every incident plotted as a color-coded dot (amber → orange → red by acreage). Click a dot to open a detail panel with full incident metadata.
- **Stats bar** — live summary of the filtered dataset: incident count, total acres, units affected, peak year, and most active unit.
- **Search** — fuzzy search across incident names (⌘K).

### Filters (sidebar)
- **Year range** — dual-handle slider spanning the full dataset extent.
- **Fire size** — quick presets: Small (< 1K acres), Medium (1K–10K), Large (10K–100K), Extreme (100K+).
- **Cause** — multi-select pill buttons. Causes with no matching incidents under current filters are greyed out.
- **Unit** — searchable checkbox list. Units incompatible with active filters are hidden automatically.

All filters stack with AND logic. Active filter count is shown on the Filters button.

### Risk Analytics panel
Click **Risk Analytics** in the header to slide up a four-chart dashboard alongside the explorer:

| Chart | Description |
|---|---|
| **Unit Risk Score** | Top 15 CAL FIRE units ranked by a composite score: fires per active year × log₁₀(avg acres + 1), normalized 0–100 |
| **Fires per Year** | Annual fire count trend from 1950 to present |
| **Fires by Cause** | Top 12 causes by incident count |
| **Avg Fire Size by Decade** | Average acres per fire, grouped by decade (min. 5 fires) |

**Cross-filtering** — every chart is interactive:
- Click a unit bar to filter the explorer table and map to that unit. The Fires per Year, Fires by Cause, and Avg Fire Size charts also recompute their data to show only that unit's history.
- Click a cause bar to filter to that cause.
- Click a year point or decade point to filter to that time window. Click again to deselect.
- Active cross-filters appear as removable chips in the orange banner. "Clear all" resets them.

---

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:5173/calfire-explorer](http://localhost:5173/calfire-explorer).

The app fetches all incident data on load (~23,000 records). The initial fetch takes a few seconds; everything is cached client-side for the session — no further network calls are made as you filter and explore.

### Build for production

```bash
npm run build
npm run preview
```

Output goes to `/build`. This is a fully static site — no server required.

### Deploy to GitHub Pages

```bash
npm run build
# push /build to the gh-pages branch, or use a GitHub Actions workflow
```

The `paths.base` in `svelte.config.js` is set to `/calfire-explorer` to match the GitHub Pages subpath. If you fork this under a different repo name, update that value.

---

## Why there's no backend

This project is intentionally frontend-only. The goal is to demonstrate how a well-structured Svelte application can handle complex data interactions — cross-filtering, derived analytics, map rendering, live search — without any server infrastructure.

The CAL FIRE ArcGIS API is publicly accessible, so all data is fetched directly from the browser at startup, normalized into a clean shape, and stored in memory. Every filter, sort, and chart computation runs client-side against that in-memory array. With ~23,000 records this is fast enough to feel instant, and it keeps the architecture simple: no API to host, no auth to manage, no deploy pipeline beyond a static build.

The tradeoff is that the dataset is bounded. This approach works well here because CAL FIRE's historic fire perimeters are a finite, read-only dataset. For anything that needs real-time updates, user-specific data, large-scale computation, or access to data that shouldn't be public, a backend becomes necessary.

---

## What a FastAPI backend would enable

A production version of this tool for internal use at a utility like PG&E would look substantially different with a FastAPI backend:

**Private and enriched data**
The public CAL FIRE dataset has no information about infrastructure. A backend could join fire perimeters against proprietary GIS layers — transmission line corridors, substation locations, vegetation management zones — and return pre-joined features rather than exposing that data to the browser.

**Server-side filtering and aggregation**
With 23,000 records, client-side filtering is fine. At enterprise scale (custom inspection records, sensor events, vegetation data) you'd push filtering and aggregation into the database and return only the rows the UI needs. FastAPI endpoints would accept the same filter parameters the frontend already uses and return paginated, pre-sorted results.

**Risk modeling beyond the current formula**
The current risk score is a simple frequency × severity heuristic computed in JavaScript. A FastAPI backend could run more sophisticated models: historical ignition probability by grid cell, wind and slope interaction factors, equipment-age weighted exposure scores. These could be precomputed nightly and served as cached scores, or run on demand for a selected area.

**Real-time and forecasted data**
A backend with scheduled jobs could pull live weather data (NOAA, RAWS stations), active fire perimeters from the CAL FIRE AGOL feed, and red flag warnings, then merge them with the historic baseline to show current conditions in the same interface.

**Authentication and role-based views**
An internal tool would need different views for different roles — field crews, planners, executives. FastAPI handles this well with JWT auth and dependency-injected permission scopes. The Svelte frontend would request data through authenticated endpoints and conditionally render sections based on the user's role.

**Audit and export**
Any analysis used to drive operational decisions needs an audit trail. A backend can log every query with the user, timestamp, and parameters, and expose export endpoints (CSV, GeoJSON, PDF report) that the current static version can't offer.

---

## Data source

**CAL FIRE — California Historic Fire Perimeters**
ArcGIS FeatureServer: `services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/California_Historic_Fire_Perimeters`

The ArcGIS endpoint is used over the CKAN API because it supports `returnCentroid=true`, appending each polygon's centroid as lat/lng — which drives the map dots. All pages are fetched in parallel after the first request establishes the total record count.

Cause codes (numeric in the raw data) are decoded to human-readable labels using the mapping from [CAL FIRE fire statistics documentation](https://www.fire.ca.gov/media/5614/firestat.pdf).

---

## Architecture decisions

### Filter sidebar animation — `transform`, not `width`
Animating CSS `width` triggers a full layout reflow on every frame, causing jank on lower-end hardware. The sidebar uses `transform: translateX(-100%)` → `translateX(0)` with `will-change: transform`, which is handled entirely by the GPU compositor without touching layout.

### Analytics as a bottom panel, not a separate view
An earlier iteration put analytics in a separate view that replaced the explorer. This made cross-filtering unintuitive — you couldn't see the table react to a chart click. The current design slides the analytics panel up from the bottom, keeping the explorer visible at all times. The panel is always mounted (not conditionally rendered) so charts subscribe to data on load.

### Leaflet map — direct store subscriptions, not reactive effects
Leaflet manages its own DOM. Svelte 5's `$effect` is brittle for conditional map state because it only tracks reactive reads that are unconditionally reached before any early return. All map updates use direct `.subscribe()` calls inside `onMount` instead. Leaflet objects are plain variables, not `$state()` — Svelte 5 wraps `$state` objects in a Proxy that breaks Leaflet's internal identity checks.

The map container has `isolation: isolate` applied, which creates a new CSS stacking context and prevents Leaflet's internal z-indexes from escaping into the page and rendering above the filter sidebar.

### Chart.js — mutate data, don't rebuild
All four charts are built once when incident data first arrives. On filter changes, data arrays and labels are mutated in place and `chart.update('none')` is called — the `'none'` argument skips animation so updates feel immediate. Rebuilding chart instances on every filter would cause a visible flash.

### Risk score formula
Unit risk score = `(fires per active year) × log₁₀(avg acres burned + 1)`, normalized 0–100. The log scale on acreage prevents a single catastrophic outlier from compressing every other unit to near-zero. "Active years" is the span from a unit's first to last recorded fire, with a floor of 1.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | SvelteKit 2 with Svelte 5 runes |
| Styling | Tailwind CSS v4 |
| Charts | Chart.js 4 |
| Map | Leaflet 1.9 |
| Deployment | `adapter-static` → GitHub Pages |
| Testing | Vitest + Testing Library |

---

## Project structure

```
src/
  lib/
    api.js          — ArcGIS fetch and normalization
    analytics.js    — pure computation functions (risk scores, trend, cause, decade)
    constants.js    — API URL, cause code map, table columns, size thresholds
    stores.js       — all shared reactive state
    utils.js        — filter matching, sorting, formatting helpers
    components/
      AnalyticsPanel.svelte   — four-chart risk dashboard
      DataTable.svelte        — sortable paginated incident table
      DetailPanel.svelte      — map click detail overlay
      FilterSidebar.svelte    — slide-out filter controls
      MapView.svelte          — Leaflet map with color-coded dots
      SearchOverlay.svelte    — ⌘K search modal
      StatsBar.svelte         — five-stat summary row
  routes/
    +page.svelte    — root layout: header, sidebar, table/map, analytics panel
```
