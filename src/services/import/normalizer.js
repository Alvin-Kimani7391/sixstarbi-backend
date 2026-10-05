const { PAYMENT_METHODS } = require('../../constants');

const CURRENCY_RE = /\b(kes|ksh|kshs|shs?|tsh|tzs|ugx|rwf|etb|usd)\b\.?|[$€£]/gi;

function parseNumber(v) {
  if (v == null || v === '') return { value: null };
  if (typeof v === 'number') return Number.isFinite(v) ? { value: v } : { error: 'Not a valid number.' };
  const original = String(v).trim();
  if (original === '' || /^(n\/?a|null|-+)$/i.test(original)) return { value: null };

  let s = original.replace(CURRENCY_RE, '').replace(/[\s\u00a0]/g, '');
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  s = s.replace(/,/g, '');
  if (!/^-?(\d+(\.\d+)?|\.\d+)$/.test(s)) return { error: `"${original}" is not a valid number.` };
  const n = negative ? -Number(s) : Number(s);
  return { value: n, corrected: /[^0-9.\-]/.test(original) };
}

const MIN_YEAR = 2000;
function utc(y, m, d, hh = 0, mm = 0) {
  const dt = new Date(Date.UTC(y, m - 1, d, hh, mm));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt : null;
}

/** Day-first for ambiguous dates (03/04/2025 = 3 April), which is the Kenyan convention. */
function parseDate(v, now = Date.now()) {
  let date = null, corrected = false, ambiguous = false;
  if (v instanceof Date) {
    date = v;
  } else if (typeof v === 'number') {
    if (v >= 20000 && v <= 80000) date = new Date(Math.round((v - 25569) * 864e5)); // Excel serial
  } else {
    const s = String(v).trim();
    let m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2}))?/.exec(s))) {
      date = utc(+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0));
    } else if ((m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})(?:[ T,]+(\d{1,2}):(\d{2}))?/.exec(s))) {
      const a = +m[1], b = +m[2];
      const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
      let day = a, month = b;
      if (a <= 12 && b > 12) { day = b; month = a; } // clearly month-first
      else if (a <= 12 && b <= 12 && a !== b) ambiguous = true;
      date = utc(y, month, day, +(m[4] || 0), +(m[5] || 0));
    } else {
      const t = Date.parse(s);
      if (!Number.isNaN(t)) { date = new Date(t); corrected = true; }
    }
  }
  if (!date || Number.isNaN(date.getTime())) return { error: `"${String(v)}" is not a valid date.` };
  if (date.getUTCFullYear() < MIN_YEAR) return { error: 'Date is before the year 2000.' };
  if (date.getTime() > now + 864e5) return { error: 'Date is in the future.' };
  return { value: date, corrected, ambiguous };
}

function normalizePayment(raw) {
  const s = String(raw).trim().toUpperCase();
  if (PAYMENT_METHODS.includes(s)) return { value: s, corrected: false };
  const t = s.toLowerCase();
  let value = 'OTHER';
  if (/m[\s-]?pesa|mobile|safaricom|airtel|till|paybill/.test(t)) value = 'MPESA';
  else if (/card|visa|master/.test(t)) value = 'CARD';
  else if (/bank|cheque|transfer|eft/.test(t)) value = 'BANK';
  else if (/cash/.test(t)) value = 'CASH';
  else if (/credit|account|debt/.test(t)) value = 'CREDIT';
  return { value, corrected: true };
}

function coerce(def, raw) {
  if (raw == null || (typeof raw === 'string' && raw.trim() === '')) return { value: null };
  switch (def.type) {
    case 'number': {
      const r = parseNumber(raw);
      if (r.error) return { error: r.error };
      if (r.value == null) return { value: null };
      if (def.positive && r.value <= 0) return { error: `${def.label} must be greater than zero.` };
      if (!def.allowNegative && r.value < 0) return { error: 'Negative values are not allowed.' };
      return { value: r.value, corrected: r.corrected };
    }
    case 'date': return parseDate(raw);
    case 'payment': return normalizePayment(raw);
    default: {
      let s = String(raw).trim().replace(/\s+/g, ' ');
      if (!s) return { value: null };
      let corrected = false;
      if (def.max && s.length > def.max) { s = s.slice(0, def.max); corrected = true; }
      return { value: s, corrected };
    }
  }
}

/**
 * Cleans one row. Required-field problems reject the row (HIGH issue).
 * Problems in optional fields drop that value and import the row (MEDIUM issue).
 */
function cleanRow(fields, rawVals, rowNo, tally) {
  const out = {};
  let corrected = false, rejected = false;
  for (const def of fields) {
    const raw = rawVals[def.key];
    if (raw === undefined) continue; // column not mapped
    const c = coerce(def, raw);
    if (c.error) {
      if (def.required) { tally.issue(rowNo, def.label, 'HIGH', c.error); rejected = true; }
      else { tally.issue(rowNo, def.label, 'MEDIUM', `${c.error} The value was ignored.`); corrected = true; }
      continue;
    }
    if (c.value == null) {
      if (def.required) { tally.issue(rowNo, def.label, 'HIGH', `${def.label} is missing.`); rejected = true; }
      continue;
    }
    if (c.ambiguous) tally.ambiguousDates += 1;
    if (c.corrected) corrected = true;
    out[def.key] = c.value;
  }
  return { out, corrected, rejected };
}

module.exports = { parseNumber, parseDate, normalizePayment, coerce, cleanRow };