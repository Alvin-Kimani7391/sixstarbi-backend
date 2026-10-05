const ApiError = require('../../utils/ApiError');

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const aliasesOf = (f) => [...new Set([norm(f.key), norm(f.label), ...f.aliases.map(norm)])];

/** Pass 1 matches exact names. Pass 2 matches longer aliases contained in a heading. One column is used once. */
function suggest(columns, fields) {
  const cols = columns.map(norm);
  const used = new Set();
  const out = {};
  const take = (f, test) => {
    const i = cols.findIndex((c, idx) => !used.has(idx) && test(c));
    if (i !== -1) { used.add(i); out[f.key] = columns[i]; }
  };
  fields.forEach((f) => { const a = aliasesOf(f); take(f, (c) => a.includes(c)); });
  fields.forEach((f) => {
    if (out[f.key]) return;
    const a = aliasesOf(f).filter((x) => x.length >= 5);
    take(f, (c) => a.some((x) => c.includes(x)));
  });
  return out;
}

function validateMapping(mapping, columns, importer) {
  const keys = new Set(importer.fields.map((f) => f.key));
  const seen = new Set();
  for (const [key, col] of Object.entries(mapping)) {
    if (!keys.has(key)) throw ApiError.badRequest(`Unknown field "${key}"`, 'INVALID_MAPPING');
    if (!columns.includes(col)) throw ApiError.badRequest(`Column "${col}" is not in the file`, 'INVALID_MAPPING');
    if (seen.has(col)) throw ApiError.badRequest(`Column "${col}" is mapped to more than one field`, 'INVALID_MAPPING');
    seen.add(col);
  }
  const missing = importer.fields.filter((f) => f.required && !mapping[f.key]).map((f) => f.label);
  if (missing.length) throw ApiError.unprocessable(`Please map: ${missing.join(', ')}`, 'MAPPING_INCOMPLETE');
  for (const group of importer.requireOneOf || []) {
    if (!group.some((k) => mapping[k])) {
      const labels = group.map((k) => importer.fields.find((f) => f.key === k).label);
      throw ApiError.unprocessable(`Please map at least one of: ${labels.join(' or ')}`, 'MAPPING_INCOMPLETE');
    }
  }
}

module.exports = { suggest, validateMapping, norm };