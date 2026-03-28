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
