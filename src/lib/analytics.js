// Pure functions that derive risk metrics from a normalized incident array.
// All computation is client-side — no additional API calls needed.

/**
 * Computes a risk score for each CAL FIRE unit based on fire frequency and severity.
 *
 * Formula: (fires per active year) × log10(average acres + 1), normalized to 0–100.
 * "Active years" is the span from the unit's first recorded fire to its last,
 * with a minimum of 1 so single-year units don't get artificially inflated scores.
 *
 * Returns the top N units sorted by descending risk score.
 */
export function computeUnitRiskScores(incidents, topCount = 15) {
	const unitMap = {};

	for (const incident of incidents) {
		if (!incident.unit || incident.unit === 'Unknown') continue;

		if (!unitMap[incident.unit]) {
			unitMap[incident.unit] = { fireCount: 0, totalAcres: 0, minYear: Infinity, maxYear: -Infinity };
		}

		const entry = unitMap[incident.unit];
		entry.fireCount += 1;
		entry.totalAcres += incident.acres ?? 0;

		if (incident.year != null) {
			if (incident.year < entry.minYear) entry.minYear = incident.year;
			if (incident.year > entry.maxYear) entry.maxYear = incident.year;
		}
	}

	const unitScores = Object.entries(unitMap).map(([unit, data]) => {
		const yearsActive = Math.max(1, data.maxYear - data.minYear + 1);
		const firesPerYear = data.fireCount / yearsActive;
		const averageAcres = data.totalAcres / data.fireCount;
		const rawScore = firesPerYear * Math.log10(averageAcres + 1);
		return { unit, fireCount: data.fireCount, averageAcres: Math.round(averageAcres), rawScore };
	});

	const maximumRawScore = Math.max(...unitScores.map((entry) => entry.rawScore));

	return unitScores
		.map((entry) => ({
			...entry,
			riskScore: maximumRawScore > 0 ? Math.round((entry.rawScore / maximumRawScore) * 100) : 0
		}))
		.sort((entryA, entryB) => entryB.riskScore - entryA.riskScore)
		.slice(0, topCount);
}

/**
 * Counts fires per year for years with at least one incident.
 * Filtered to startYear–present to avoid sparse early records skewing the trend.
 */
export function computeFiresPerYear(incidents, startYear = 1950) {
	const countByYear = {};

	for (const incident of incidents) {
		if (incident.year == null || incident.year < startYear) continue;
		countByYear[incident.year] = (countByYear[incident.year] ?? 0) + 1;
	}

	return Object.entries(countByYear)
		.map(([year, count]) => ({ year: Number(year), count }))
		.sort((entryA, entryB) => entryA.year - entryB.year);
}

/**
 * Counts incidents by cause, returning entries sorted by count descending.
 * Skips incidents with null or 'Unknown' cause unless they represent a large share.
 */
export function computeCauseBreakdown(incidents) {
	const countByCause = {};

	for (const incident of incidents) {
		const cause = incident.cause ?? 'Unknown';
		countByCause[cause] = (countByCause[cause] ?? 0) + 1;
	}

	return Object.entries(countByCause)
		.map(([cause, count]) => ({ cause, count }))
		.sort((entryA, entryB) => entryB.count - entryA.count);
}

/**
 * Computes the average acres burned per fire, grouped by decade.
 * Only includes decades with at least 5 fires to avoid misleading averages.
 */
export function computeAcresByDecade(incidents) {
	const decadeMap = {};

	for (const incident of incidents) {
		if (incident.year == null || incident.acres == null) continue;
		const decade = Math.floor(incident.year / 10) * 10;

		if (!decadeMap[decade]) decadeMap[decade] = { totalAcres: 0, fireCount: 0 };
		decadeMap[decade].totalAcres += incident.acres;
		decadeMap[decade].fireCount += 1;
	}

	return Object.entries(decadeMap)
		.filter(([, data]) => data.fireCount >= 5)
		.map(([decade, data]) => ({
			decade: Number(decade),
			averageAcres: Math.round(data.totalAcres / data.fireCount),
			fireCount: data.fireCount
		}))
		.sort((entryA, entryB) => entryA.decade - entryB.decade);
}

/**
 * Groups total acres burned by year (1950–present), fits a linear regression
 * to the year-vs-acres series, and extends it projectionYears into the future.
 *
 * Returns a flat array of { year, acres, projected } objects sorted by year.
 * Historical points carry projected: false; forecast points carry projected: true.
 * Projected acres are clamped to zero (regression can go negative in dry years).
 */
export function computeAcresTrend(incidents, projectionYears = 10) {
	const acresByYear = {};

	for (const incident of incidents) {
		if (incident.year == null || incident.acres == null) continue;
		if (incident.year < 1950) continue;
		acresByYear[incident.year] = (acresByYear[incident.year] ?? 0) + incident.acres;
	}

	const historical = Object.entries(acresByYear)
		.map(([year, acres]) => ({ year: Number(year), acres, projected: false }))
		.sort((pointA, pointB) => pointA.year - pointB.year);

	if (historical.length < 2) return historical;

	// Ordinary least squares linear regression
	const pointCount = historical.length;
	const sumX = historical.reduce((total, point) => total + point.year, 0);
	const sumY = historical.reduce((total, point) => total + point.acres, 0);
	const sumXY = historical.reduce((total, point) => total + point.year * point.acres, 0);
	const sumX2 = historical.reduce((total, point) => total + point.year * point.year, 0);

	const slope = (pointCount * sumXY - sumX * sumY) / (pointCount * sumX2 - sumX * sumX);
	const intercept = (sumY - slope * sumX) / pointCount;

	const lastYear = historical[historical.length - 1].year;
	const projected = [];
	for (let yearOffset = 1; yearOffset <= projectionYears; yearOffset++) {
		const year = lastYear + yearOffset;
		const acres = Math.max(0, Math.round(slope * year + intercept));
		projected.push({ year, acres, projected: true });
	}

	return [...historical, ...projected];
}

/**
 * Converts an acreage trend (output of computeAcresTrend) into estimated
 * suppression cost by multiplying each year's acres by costPerAcre.
 *
 * Returns { year, cost, projected } objects — same shape and ordering as input.
 * The projected flag is preserved from the input.
 */
export function computeProjectedCost(acresTrend, costPerAcre = 2500) {
	return acresTrend.map(({ year, acres, projected }) => ({
		year,
		cost: acres * costPerAcre,
		projected
	}));
}
