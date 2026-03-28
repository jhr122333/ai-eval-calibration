/**
 * disagreementDetector.js
 *
 * Pure functions for inter-rater disagreement analysis.
 * Input: normalized rows from parser.js
 * ({ contentId, evaluatorId, criterion, score, reason })
 */

// ── Math helpers ───────────────────────────────────────────────────────────────

function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function scoreDistribution(values) {
  const dist = { 0: 0, 1: 0, 2: 0 };
  values.forEach(v => { dist[v] = (dist[v] ?? 0) + 1; });
  return dist;
}

// ── Group-by helper ────────────────────────────────────────────────────────────

function groupBy(rows, keyFn) {
  const map = new Map();
  rows.forEach(row => {
    const key = keyFn(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  return map;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Calculates per-(content, criterion) disagreement metrics.
 * Returns array sorted by stdDev descending.
 */
export function calculateDisagreement(data) {
  const grouped = groupBy(data, r => `${r.contentId}__${r.criterion}`);
  const results = [];

  grouped.forEach((rows, key) => {
    const [contentId, criterion] = key.split('__');
    const scores = rows.map(r => r.score);
    results.push({
      contentId,
      criterion,
      stdDev: stdDev(scores),
      mean: mean(scores),
      scores: rows.map(r => ({ evaluatorId: r.evaluatorId, score: r.score, reason: r.reason })),
      scoreDistribution: scoreDistribution(scores),
    });
  });

  return results.sort((a, b) => b.stdDev - a.stdDev);
}

/**
 * Calculates per-evaluator bias metrics.
 * Returns array sorted by avgScore descending (most lenient first).
 */
export function calculateEvaluatorBias(data) {
  const grouped = groupBy(data, r => r.evaluatorId);
  const globalMean = mean(data.map(r => r.score));
  const results = [];

  grouped.forEach((rows, evaluatorId) => {
    const scores = rows.map(r => r.score);
    const avg = mean(scores);

    // Criterion averages
    const criterionGroups = groupBy(rows, r => r.criterion);
    const criterionAvgs = {};
    criterionGroups.forEach((cRows, criterion) => {
      criterionAvgs[criterion] = mean(cRows.map(r => r.score));
    });

    // Bias label: ±0.2 threshold from global mean
    let biasLabel = 'neutral';
    if (avg > globalMean + 0.2) biasLabel = 'lenient';
    else if (avg < globalMean - 0.2) biasLabel = 'strict';

    results.push({
      evaluatorId,
      avgScore: avg,
      scoreDistribution: scoreDistribution(scores),
      biasLabel,
      deviationFromMean: avg - globalMean,
      criterionAvgs,
    });
  });

  return results.sort((a, b) => b.avgScore - a.avgScore);
}

/**
 * Calculates per-content summary statistics.
 * Returns array sorted by overallStdDev descending.
 */
export function calculateContentSummary(data) {
  const grouped = groupBy(data, r => r.contentId);
  const results = [];

  grouped.forEach((rows, contentId) => {
    const scores = rows.map(r => r.score);

    const criterionGroups = groupBy(rows, r => r.criterion);
    const criterionStats = {};
    criterionGroups.forEach((cRows, criterion) => {
      const cScores = cRows.map(r => r.score);
      criterionStats[criterion] = {
        avg: mean(cScores),
        stdDev: stdDev(cScores),
      };
    });

    results.push({
      contentId,
      overallAvg: mean(scores),
      overallStdDev: stdDev(scores),
      criterionStats,
    });
  });

  return results.sort((a, b) => b.overallStdDev - a.overallStdDev);
}

/**
 * Generates heatmap matrix data.
 * @param {object[]} data
 * @param {'evaluator'|'content'} rowDimension - what to use as rows
 * @param {'stdDev'|'mean'} valueMetric - which metric to use as cell value
 */
export function generateHeatmapData(data, rowDimension = 'evaluator', valueMetric = 'mean') {
  const criteria = [...new Set(data.map(r => r.criterion))].sort();

  let rowKeys;
  let getRowKey;

  if (rowDimension === 'evaluator') {
    rowKeys = [...new Set(data.map(r => r.evaluatorId))].sort();
    getRowKey = r => r.evaluatorId;
  } else {
    rowKeys = [...new Set(data.map(r => r.contentId))].sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, ''));
      const nb = parseInt(b.replace(/\D/g, ''));
      return na - nb;
    });
    getRowKey = r => r.contentId;
  }

  // Build lookup: rowKey → criterion → [scores]
  const lookup = new Map();
  data.forEach(row => {
    const rk = getRowKey(row);
    if (!lookup.has(rk)) lookup.set(rk, new Map());
    const inner = lookup.get(rk);
    if (!inner.has(row.criterion)) inner.set(row.criterion, []);
    inner.get(row.criterion).push(row.score);
  });

  const values = rowKeys.map(rk => {
    const inner = lookup.get(rk) ?? new Map();
    return criteria.map(c => {
      const scores = inner.get(c) ?? [];
      if (scores.length === 0) return null;
      return valueMetric === 'stdDev' ? stdDev(scores) : mean(scores);
    });
  });

  return { rows: rowKeys, columns: criteria, values };
}

function isReviewComparisonRow(row) {
  return typeof row?.primaryScore === 'number' && typeof row?.secondaryScore === 'number';
}

function changeDirection(rows) {
  return rows.reduce(
    (acc, row) => {
      if (row.secondaryScore > row.primaryScore) acc.upward += 1;
      if (row.secondaryScore < row.primaryScore) acc.downward += 1;
      return acc;
    },
    { upward: 0, downward: 0 }
  );
}

/**
 * Calculates overall review accuracy metrics for primary-vs-secondary comparison data.
 */
export function calculateReviewSummary(data) {
  const rows = data.filter(isReviewComparisonRow);
  const totalRows = rows.length;
  const changedRows = rows.filter(row => row.primaryScore !== row.secondaryScore);
  const matchedRows = totalRows - changedRows.length;
  const criterionStats = calculateCriterionChangeRates(rows);
  const evaluatorStats = calculateEvaluatorAccuracy(rows);
  const directions = changeDirection(changedRows);

  return {
    totalRows,
    matchedRows,
    changedCount: changedRows.length,
    accuracy: totalRows ? matchedRows / totalRows : 0,
    upwardChanges: directions.upward,
    downwardChanges: directions.downward,
    worstCriterion: criterionStats[0] ?? null,
    mostCorrectedEvaluator: evaluatorStats[0] ?? null,
  };
}

/**
 * Calculates per-primary-evaluator review accuracy metrics.
 * Returns array sorted by changeRate descending.
 */
export function calculateEvaluatorAccuracy(data) {
  const rows = data.filter(isReviewComparisonRow);
  const grouped = groupBy(rows, row => row.primaryEvaluatorId);
  const results = [];

  grouped.forEach((evaluatorRows, evaluatorId) => {
    const changedRows = evaluatorRows.filter(row => row.primaryScore !== row.secondaryScore);
    const matchedRows = evaluatorRows.length - changedRows.length;
    const directions = changeDirection(changedRows);

    results.push({
      evaluatorId,
      total: evaluatorRows.length,
      matchedCount: matchedRows,
      changedCount: changedRows.length,
      accuracy: evaluatorRows.length ? matchedRows / evaluatorRows.length : 0,
      changeRate: evaluatorRows.length ? changedRows.length / evaluatorRows.length : 0,
      upwardChanges: directions.upward,
      downwardChanges: directions.downward,
    });
  });

  return results.sort((a, b) => b.changeRate - a.changeRate);
}

/**
 * Calculates per-criterion change rates.
 * Returns array sorted by changeRate descending.
 */
export function calculateCriterionChangeRates(data) {
  const rows = data.filter(isReviewComparisonRow);
  const grouped = groupBy(rows, row => row.criterion);
  const results = [];

  grouped.forEach((criterionRows, criterion) => {
    const changedRows = criterionRows.filter(row => row.primaryScore !== row.secondaryScore);
    const matchedRows = criterionRows.length - changedRows.length;
    const directions = changeDirection(changedRows);

    results.push({
      criterion,
      total: criterionRows.length,
      matchedCount: matchedRows,
      changedCount: changedRows.length,
      accuracy: criterionRows.length ? matchedRows / criterionRows.length : 0,
      changeRate: criterionRows.length ? changedRows.length / criterionRows.length : 0,
      upwardChanges: directions.upward,
      downwardChanges: directions.downward,
    });
  });

  return results.sort((a, b) => b.changeRate - a.changeRate);
}

/**
 * Generates evaluator × criterion change-rate heatmap data.
 * Returns percentage-style rates in 0..1 range.
 */
export function generateEvaluatorCriterionChangeHeatmap(data) {
  const rows = data.filter(isReviewComparisonRow);
  const evaluators = [...new Set(rows.map(row => row.primaryEvaluatorId))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );
  const criteria = [...new Set(rows.map(row => row.criterion))].sort();

  const lookup = new Map();
  rows.forEach((row) => {
    const key = `${row.primaryEvaluatorId}__${row.criterion}`;
    if (!lookup.has(key)) lookup.set(key, []);
    lookup.get(key).push(row);
  });

  const values = evaluators.map((evaluatorId) =>
    criteria.map((criterion) => {
      const cellRows = lookup.get(`${evaluatorId}__${criterion}`) ?? [];
      if (cellRows.length === 0) return null;
      const changedCount = cellRows.filter((row) => row.primaryScore !== row.secondaryScore).length;
      return changedCount / cellRows.length;
    })
  );

  return { rows: evaluators, columns: criteria, values };
}

/**
 * Calculates per-content review accuracy metrics.
 * Returns array sorted by changeRate descending.
 */
export function calculateContentChangeSummary(data) {
  const rows = data.filter(isReviewComparisonRow);
  const grouped = groupBy(rows, row => row.contentId);
  const results = [];

  grouped.forEach((contentRows, contentId) => {
    const changedRows = contentRows.filter(row => row.primaryScore !== row.secondaryScore);
    const criterionGroups = groupBy(contentRows, row => row.criterion);
    const criterionStats = {};

    criterionGroups.forEach((criterionRows, criterion) => {
      const changedCount = criterionRows.filter((row) => row.primaryScore !== row.secondaryScore).length;
      const total = criterionRows.length;
      criterionStats[criterion] = {
        total,
        changedCount,
        accuracy: total ? (total - changedCount) / total : 0,
        changeRate: total ? changedCount / total : 0,
      };
    });

    results.push({
      contentId,
      total: contentRows.length,
      changedCount: changedRows.length,
      accuracy: contentRows.length ? (contentRows.length - changedRows.length) / contentRows.length : 0,
      changeRate: contentRows.length ? changedRows.length / contentRows.length : 0,
      criterionStats,
    });
  });

  return results.sort((a, b) => b.changeRate - a.changeRate);
}

/**
 * Generates content × criterion change-rate heatmap data.
 */
export function generateContentCriterionChangeHeatmap(data) {
  const rows = data.filter(isReviewComparisonRow);
  const contents = [...new Set(rows.map((row) => row.contentId))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );
  const criteria = [...new Set(rows.map((row) => row.criterion))].sort();

  const lookup = new Map();
  rows.forEach((row) => {
    const key = `${row.contentId}__${row.criterion}`;
    if (!lookup.has(key)) lookup.set(key, []);
    lookup.get(key).push(row);
  });

  const values = contents.map((contentId) =>
    criteria.map((criterion) => {
      const cellRows = lookup.get(`${contentId}__${criterion}`) ?? [];
      if (cellRows.length === 0) return null;
      const changedCount = cellRows.filter((row) => row.primaryScore !== row.secondaryScore).length;
      return changedCount / cellRows.length;
    })
  );

  return { rows: contents, columns: criteria, values };
}
