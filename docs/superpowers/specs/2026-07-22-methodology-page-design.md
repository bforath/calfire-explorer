# Methodology Page Design

**Date:** 2026-07-22
**Status:** Approved

## Goal

Add a dedicated `/methodology` page to calfire-explorer that tells two stories in sequence:

1. **ETL / Data Pipeline** — how the raw ArcGIS API data is fetched, normalized, and delivered to the client. Demonstrates data engineering judgment to portfolio reviewers.
2. **Cost & Projections** — estimated fire suppression cost per year derived from acreage data and a published CAL FIRE benchmark, projected forward 10 years using linear regression.

The page is a single scrollable document — not tabbed — so the narrative flows naturally from data source through transformation to insight.

## Architecture

- New SvelteKit route: `src/routes/methodology/+page.svelte`
- "Methodology" link added to existing nav in `src/routes/+layout.svelte`
- No new dependencies — pipeline diagram is HTML/CSS, regression is pure JS
- Page reads from the existing `incidents` store (already loaded by the main page on app boot)
- Two new pure functions added to `src/lib/analytics.js`

## Page Sections

### 1. Data Pipeline

An HTML/CSS flow diagram showing the data path from source to client:

```
ArcGIS FeatureServer API
  → scripts/fetch-data.js   (paginates, normalizes, writes snapshot)
  → static/incidents.json   (pre-built static snapshot)
  → src/lib/api.js          (loads snapshot or falls back to live API)
  → incidents store         (reactive Svelte store)
  → analytics.js            (pure functions derive metrics client-side)
```

Each node displays its role in one line. Arrows between nodes. Static — no interactivity.

### 2. Field Mapping Table

Four columns: **Raw ArcGIS Field** | **Normalized Field** | **Type** | **Transformation**

All 12 fields in the normalized incident model are listed. Computed fields are highlighted:

| Raw Field | Normalized Field | Type | Transformation |
|---|---|---|---|
| OBJECTID | id | number | direct |
| FIRE_NAME | name | string | trimmed, defaults to "Unknown" |
| UNIT_ID | unit | string | direct, defaults to "Unknown" |
| AGENCY | agency | string | direct, nullable |
| YEAR_ | year | number | direct, nullable |
| CAUSE | cause | string | decoded via CAUSE_CODES lookup (19 codes, sourced from CAL FIRE firestat.pdf) |
| GIS_ACRES | acres | number | rounded to integer, nullable |
| ALARM_DATE | startDate | string | ArcGIS timestamp (ms) → ISO date string |
| CONT_DATE | endDate | string | ArcGIS timestamp (ms) → ISO date string |
| (computed) | durationDays | number | (endDate − startDate) in days, nullable if either date missing |
| centroid.y | lat | number | WGS84 latitude from returnCentroid, nullable |
| centroid.x | lng | number | WGS84 longitude from returnCentroid, nullable |

### 3. Data Quality

Four KPI cards:
- **Total Records** — count of all incidents in the dataset
- **Date Range** — earliest year → latest year with at least one recorded incident
- **% Unknown Cause** — proportion of incidents where cause is null or "Unknown"
- **% Missing Acres** — proportion of incidents where acres is null

A short paragraph below the cards explains what the gaps mean: early records predate standardized cause reporting; GIS_ACRES is derived from perimeter geometry and can be absent for older fires with poor spatial data.

### 4. Cost & Projections

Two Chart.js line charts displayed side by side:

**Left — Acres Burned per Year**
- Solid line: historical total acres burned per year, 1950–present
- Dashed line (gray, `#9ca3af`): 10-year linear regression projection
- Y-axis: total acres, X-axis: year

**Right — Estimated Suppression Cost per Year**
- Same shape as the left chart, Y-axis shows dollars (acres × $2,500/acre benchmark)
- Solid line: historical estimate, dashed line: projection
- Footnote below both charts cites the cost benchmark and states explicitly that dollar values are estimates derived from acreage, not reported expenditures. The $2,500/acre figure comes from CAL FIRE's Fire and Resource Assessment Program (FRAP) cost reports — the specific year and URL must be verified and linked before implementation

## New Analytics Functions

Both functions are pure (no side effects, no store dependencies) and live in `src/lib/analytics.js`.

### `computeAcresTrend(incidents, projectionYears = 10)`

1. Groups incidents by year, summing total acres per year (1950–present, skipping null years/acres)
2. Fits a simple linear regression (ordinary least squares) to the year-vs-total-acres series
3. Returns historical data points plus a projection array extending `projectionYears` years past the last recorded year
4. Each projected point is flagged: `{ year, acres, projected: true }`
5. Historical points carry `projected: false`

### `computeProjectedCost(acresTrend, costPerAcre = 2500)`

1. Maps over the output of `computeAcresTrend`
2. Multiplies each year's acres by `costPerAcre` to produce an estimated cost
3. Returns the same shape — `{ year, cost, projected: boolean }` — with the flag preserved
4. `costPerAcre` is an explicit parameter so the methodology page can display the value and source to readers

## Error Handling

- The page reads from the existing `incidents` store and inherits its loading/error state
- While loading: charts and KPI cards show a simple centered spinner (no existing skeleton pattern in the app)
- No new error surface area introduced

## Testing

Unit tests for both new functions added to `src/lib/utils.test.js`:

- `computeAcresTrend`: verify slope direction is positive for a dataset with increasing acres, verify projected years are correctly flagged, verify no projected points appear before the last historical year
- `computeProjectedCost`: verify the cost multiplier is applied correctly, verify the `projected` flag is preserved from input, verify default `costPerAcre` of 2500 is used when not specified

## Out of Scope

- Filtering the methodology page by unit, cause, or year (this page always shows the full dataset)
- Saving or exporting projections
- Non-linear regression models (linear is appropriate and defensible for this dataset size and purpose)
- Per-cause cost breakdown
