import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const LEGACY_COLUMNS = ['content_id', 'evaluator_id', 'criterion', 'score', 'reason'];
const REVIEW_COLUMNS = [
  'content_id',
  'primary_evaluator_id',
  'reviewer_id',
  'criterion',
  'primary_score',
  'secondary_score',
  'primary_reason',
  'secondary_reason',
];
const VALID_SCORES = new Set([0, 1, 2]);

function detectSchema(headers) {
  if (REVIEW_COLUMNS.every((col) => headers.includes(col))) {
    return 'review-comparison';
  }

  if (LEGACY_COLUMNS.every((col) => headers.includes(col))) {
    return 'legacy';
  }

  const missingReview = REVIEW_COLUMNS.filter((col) => !headers.includes(col));
  const missingLegacy = LEGACY_COLUMNS.filter((col) => !headers.includes(col));
  throw new Error(
    `Unsupported columns. Missing review schema columns: ${missingReview.join(', ') || 'none'}. Missing legacy schema columns: ${missingLegacy.join(', ') || 'none'}.`
  );
}

function parseScore(value, label, rowNumber) {
  const score = Number.parseInt(value, 10);
  if (!VALID_SCORES.has(score)) {
    throw new Error(`Row ${rowNumber}: invalid ${label} "${value}" (must be 0, 1, or 2)`);
  }
  return score;
}

function normalizeLegacyRows(rawRows) {
  const rows = [];
  const errors = [];

  rawRows.forEach((row, idx) => {
    const rowNumber = idx + 2;

    try {
      const score = parseScore(row.score, 'score', rowNumber);
      rows.push({
        schema: 'legacy',
        contentId: String(row.content_id).trim(),
        evaluatorId: String(row.evaluator_id).trim(),
        criterion: String(row.criterion).trim(),
        score,
        reason: String(row.reason ?? '').trim(),
      });
    } catch (error) {
      errors.push(error.message);
    }
  });

  return { rows, errors };
}

function normalizeReviewRows(rawRows) {
  const rows = [];
  const errors = [];

  rawRows.forEach((row, idx) => {
    const rowNumber = idx + 2;

    try {
      const primaryEvaluatorId = String(row.primary_evaluator_id).trim();
      const reviewerId = String(row.reviewer_id).trim();
      const criterion = String(row.criterion).trim();
      const contentId = String(row.content_id).trim();
      const primaryScore = parseScore(row.primary_score, 'primary_score', rowNumber);
      const secondaryScore = parseScore(row.secondary_score, 'secondary_score', rowNumber);
      const primaryReason = String(row.primary_reason ?? '').trim();
      const secondaryReason = String(row.secondary_reason ?? '').trim();

      if (!contentId || !primaryEvaluatorId || !reviewerId || !criterion) {
        throw new Error(`Row ${rowNumber}: content_id, primary_evaluator_id, reviewer_id, criterion are required`);
      }

      rows.push({
        schema: 'review-comparison',
        contentId,
        criterion,
        primaryEvaluatorId,
        reviewerId,
        primaryScore,
        secondaryScore,
        primaryReason,
        secondaryReason,
        isChanged: primaryScore !== secondaryScore,
        scoreDelta: secondaryScore - primaryScore,

        // Compatibility fields for the current single-score dashboard.
        evaluatorId: primaryEvaluatorId,
        score: primaryScore,
        reason: primaryReason,
      });
    } catch (error) {
      errors.push(error.message);
    }
  });

  return { rows, errors };
}

function buildSummary(rows, schema) {
  if (schema === 'review-comparison') {
    return {
      schema,
      rows: rows.length,
      evaluators: [...new Set(rows.map((row) => row.primaryEvaluatorId))].sort(),
      primaryEvaluators: [...new Set(rows.map((row) => row.primaryEvaluatorId))].sort(),
      reviewers: [...new Set(rows.map((row) => row.reviewerId))].sort(),
      contents: [...new Set(rows.map((row) => row.contentId))].sort(),
      criteria: [...new Set(rows.map((row) => row.criterion))].sort(),
      accuracy:
        rows.length > 0
          ? rows.filter((row) => !row.isChanged).length / rows.length
          : 0,
      changedCount: rows.filter((row) => row.isChanged).length,
    };
  }

  return {
    schema,
    rows: rows.length,
    evaluators: [...new Set(rows.map((row) => row.evaluatorId))].sort(),
    contents: [...new Set(rows.map((row) => row.contentId))].sort(),
    criteria: [...new Set(rows.map((row) => row.criterion))].sort(),
  };
}

function normalizeRows(rawRows, schema) {
  return schema === 'review-comparison'
    ? normalizeReviewRows(rawRows)
    : normalizeLegacyRows(rawRows);
}

function parseStructuredRows(rawRows, headers) {
  const schema = detectSchema(headers);
  const { rows, errors } = normalizeRows(rawRows, schema);
  return { data: rows, errors, summary: buildSummary(rows, schema) };
}

export function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'csv') {
    return parseCsv(file);
  }

  if (ext === 'xlsx' || ext === 'xls') {
    return parseExcel(file);
  }

  return Promise.reject(new Error(`Unsupported file type: .${ext}. Please upload a CSV or Excel file.`));
}

function parseCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        try {
          resolve(parseStructuredRows(results.data, results.meta.fields ?? []));
        } catch (error) {
          reject(error);
        }
      },
      error(error) {
        reject(new Error(`CSV parse error: ${error.message}`));
      },
    });
  });
}

function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (rawRows.length === 0) {
          throw new Error('Excel sheet is empty.');
        }

        resolve(parseStructuredRows(rawRows, Object.keys(rawRows[0])));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsArrayBuffer(file);
  });
}

export async function loadDemoData() {
  const response = await fetch('./demo_calibration_data.csv');
  if (!response.ok) {
    throw new Error('Failed to load demo data.');
  }

  const text = await response.text();
  const results = Papa.parse(text, { header: true, skipEmptyLines: true });
  return parseStructuredRows(results.data, results.meta.fields ?? []);
}
