const XLSX = require('xlsx');
const { parse } = require('csv-parse/sync');
const ApiError = require('../../utils/ApiError');
const { IMPORT_LIMITS } = require('../../constants');

function detectDelimiter(buf) {
  const head = buf.toString('utf8', 0, 4096).split(/\r?\n/)[0] || '';
  const best = [',', ';', '\t', '|'].map((d) => [d, head.split(d).length - 1]).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ',';
}

function toMatrix(buffer, ext) {
  if (ext === 'csv') {
    return parse(buffer, {
      bom: true, delimiter: detectDelimiter(buffer), relax_column_count: true,
      relax_quotes: true, skip_empty_lines: false, trim: true,
    });
  }
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
}

const isBlank = (row) => !row || row.every((c) => c == null || String(c).trim() === '');

function uniqueHeaders(row) {
  const seen = new Map();
  const headers = row.map((h, i) => {
    const base = String(h ?? '').trim() || `Column ${i + 1}`;
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });
  return headers;
}

/** Returns { columns, rows: [{ rowNo, cells }] } where rowNo is the row number in the original file. */
function parseTable(buffer, ext) {
  let matrix;
  try {
    matrix = toMatrix(buffer, ext);
  } catch {
    throw ApiError.unprocessable('We could not read this file. Check that it is a valid CSV or Excel file.', 'UNREADABLE_FILE');
  }
  const headerIdx = matrix.findIndex((r) => !isBlank(r));
  if (headerIdx === -1) throw ApiError.unprocessable('The file is empty.', 'EMPTY_FILE');

  let headerRow = matrix[headerIdx];
  while (headerRow.length && (headerRow[headerRow.length - 1] == null || String(headerRow[headerRow.length - 1]).trim() === '')) {
    headerRow = headerRow.slice(0, -1);
  }
  const columns = uniqueHeaders(headerRow);

  const rows = [];
  for (let i = headerIdx + 1; i < matrix.length; i += 1) {
    if (isBlank(matrix[i])) continue;
    rows.push({ rowNo: i + 1, cells: matrix[i] });
  }
  if (!rows.length) throw ApiError.unprocessable('The file has column headings but no data rows.', 'NO_DATA_ROWS');
  if (rows.length > IMPORT_LIMITS.MAX_ROWS) {
    throw ApiError.unprocessable(
      `This file has ${rows.length.toLocaleString()} rows. The limit is ${IMPORT_LIMITS.MAX_ROWS.toLocaleString()}. Split it into smaller files.`,
      'TOO_MANY_ROWS'
    );
  }
  return { columns, rows };
}

module.exports = { parseTable };