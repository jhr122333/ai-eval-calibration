import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const REQUIRED_COLUMNS = ['content_id', 'evaluator_id', 'criterion', 'score', 'reason'];
const VALID_SCORES = new Set([0, 1, 2]);

/**
 * Validates that required columns are present in the parsed headers.
 */
function validateColumns(headers) {
  const missing = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
  if (missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.join(', ')}`);
  }
}

/**
 * Normalizes and validates rows from parsed data.
 * Returns { rows, errors }.
 */
function normalizeRows(rawRows) {
  const rows = [];
  const errors = [];

  rawRows.forEach((row, idx) => {
    const score = parseInt(row.score, 10);
    if (!VALID_SCORES.has(score)) {
      errors.push(`Row ${idx + 2}: invalid score "${row.score}" (must be 0, 1, or 2)`);
      return;
    }
    rows.push({
      contentId: String(row.content_id).trim(),
      evaluatorId: String(row.evaluator_id).trim(),
      criterion: String(row.criterion).trim(),
      score,
      reason: String(row.reason ?? '').trim(),
    });
  });

  return { rows, errors };
}

/**
 * Builds a summary of unique entities in the dataset.
 */
function buildSummary(rows) {
  return {
    rows: rows.length,
    evaluators: [...new Set(rows.map(r => r.evaluatorId))].sort(),
    contents: [...new Set(rows.map(r => r.contentId))].sort(),
    criteria: [...new Set(rows.map(r => r.criterion))].sort(),
  };
}

/**
 * Parses a CSV or Excel file and returns structured evaluation data.
 * @param {File} file
 * @returns {Promise<{ data: object[], errors: string[], summary: object }>}
 */
export function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'csv') {
    return parseCsv(file);
  } else if (ext === 'xlsx' || ext === 'xls') {
    return parseExcel(file);
  } else {
    return Promise.reject(new Error(`Unsupported file type: .${ext}. Please upload a CSV or Excel file.`));
  }
}

function parseCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        try {
          validateColumns(results.meta.fields);
          const { rows, errors } = normalizeRows(results.data);
          resolve({ data: rows, errors, summary: buildSummary(rows) });
        } catch (err) {
          reject(err);
        }
      },
      error(err) {
        reject(new Error(`CSV parse error: ${err.message}`));
      },
    });
  });
}

function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (rawRows.length === 0) throw new Error('Excel sheet is empty.');
        validateColumns(Object.keys(rawRows[0]));

        const { rows, errors } = normalizeRows(rawRows);
        resolve({ data: rows, errors, summary: buildSummary(rows) });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Fetches and parses the bundled demo CSV from public/.
 * @returns {Promise<{ data: object[], errors: string[], summary: object }>}
 */
export async function loadDemoData() {
  const res = await fetch('./demo_calibration_data.csv');
  if (!res.ok) throw new Error('Failed to load demo data.');
  const text = await res.text();
  const results = Papa.parse(text, { header: true, skipEmptyLines: true });
  validateColumns(results.meta.fields);
  const { rows, errors } = normalizeRows(results.data);
  return { data: rows, errors, summary: buildSummary(rows) };
}
