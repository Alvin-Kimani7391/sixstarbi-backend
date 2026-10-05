const crypto = require('crypto');
const repo = require('../repositories/import.repository');
const uploadService = require('./upload.service');
const dataSource = require('./dataSource.service');
const dataQuality = require('./dataQuality.service');
const parser = require('./import/parser');
const mapper = require('./import/columnMapper');
const importers = require('./import/importers');
const { parseDate } = require('./import/normalizer');
const fileValidation = require('../utils/fileValidation');
const ApiError = require('../utils/ApiError');

const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const SPREADSHEETS = ['csv', 'xlsx', 'xls'];

// Show Excel date serials as real dates in the preview table.
const previewCell = (v, isDate) => {
  if (v == null) return '';
  if (isDate && typeof v === 'number') {
    const d = parseDate(v, Infinity);
    return d.value ? d.value.toISOString().slice(0, 10) : v;
  }
  return v;
};

async function preview({ user, businessId, type, file }) {
  const importer = importers[type];
  if (!file) throw ApiError.badRequest('Choose a file to upload', 'FILE_REQUIRED');
  const kind = fileValidation.detect(file);
  if (!kind || !SPREADSHEETS.includes(kind.kind)) {
    throw ApiError.badRequest('Please upload a .csv or .xlsx file.', 'FILE_TYPE_NOT_ALLOWED');
  }

  const fileHash = sha256(file.buffer);
  const prior = await repo.findCompletedByHash(businessId, type, fileHash);
  if (prior) {
    throw ApiError.conflict(
      `This exact file was already imported on ${prior.createdAt.toISOString().slice(0, 10)}. Importing it again would duplicate your data.`,
      'ALREADY_IMPORTED'
    );
  }

  const table = parser.parseTable(file.buffer, kind.kind === 'csv' ? 'csv' : 'xlsx');
  const suggestedMapping = mapper.suggest(table.columns, importer.fields);

  const asset = await uploadService.store({ businessId, userId: user._id, folder: 'imports', file, kind });
  const sourceType = kind.kind === 'csv' ? 'CSV' : 'EXCEL';
  const ds = await dataSource.getOrCreate(businessId, sourceType, sourceType === 'CSV' ? 'CSV imports' : 'Excel imports');

  const imp = await repo.create({
    businessId, userId: user._id, type, fileName: asset.fileName, fileSize: file.size, fileHash,
    assetId: asset._id, dataSourceId: ds._id, sourceType, status: 'PREVIEW',
    columns: table.columns, totalRows: table.rows.length, suggestedMapping,
  });

  const dateCols = new Set(importer.fields.filter((f) => f.type === 'date' && suggestedMapping[f.key]).map((f) => suggestedMapping[f.key]));
  const sampleRows = table.rows.slice(0, 5).map((r) =>
    Object.fromEntries(table.columns.map((c, i) => [c, previewCell(r.cells[i], dateCols.has(c))]))
  );

  return {
    importId: imp._id, fileName: imp.fileName, type, columns: table.columns, suggestedMapping,
    fields: importer.fields.map(({ key, label, required }) => ({ key, label, required: Boolean(required) })),
    sampleRows, totalRows: table.rows.length,
  };
}

async function processImport({ user, businessId, id, mapping }) {
  const found = await repo.findById(businessId, id);
  if (!found) throw ApiError.notFound('Import not found');
  if (found.status !== 'PREVIEW') {
    throw ApiError.conflict('This import has already been processed or is being processed.', 'IMPORT_NOT_READY');
  }
  const importer = importers[found.type];
  // Validate before claiming, so a bad mapping leaves the import ready to be corrected.
  mapper.validateMapping(mapping, found.columns, importer);

  const imp = await repo.claim(businessId, id);
  if (!imp) throw ApiError.conflict('This import is already being processed.', 'IMPORT_NOT_READY');

  try {
    const asset = await uploadService.getAsset(businessId, imp.assetId);
    const buffer = await uploadService.download(asset);
    if (sha256(buffer) !== imp.fileHash) {
      throw ApiError.conflict('The stored file does not match the uploaded one. Please upload it again.', 'FILE_CHANGED');
    }

    const table = parser.parseTable(buffer, imp.sourceType === 'CSV' ? 'csv' : 'xlsx');
    const index = new Map(table.columns.map((c, i) => [c, i]));
    const rows = table.rows.map((r) => {
      const vals = {};
      importer.fields.forEach((f) => {
        const col = mapping[f.key];
        vals[f.key] = col ? (r.cells[index.get(col)] ?? null) : undefined; // undefined = not mapped
      });
      return { rowNo: r.rowNo, vals };
    });

    const { tally, stats } = await importer.run({
      businessId, rows,
      ctx: { importId: imp._id, userId: user._id, sourceType: imp.sourceType },
    });
    stats.ambiguousDates = tally.ambiguousDates;

    imp.set({
      status: 'COMPLETED', mapping, totals: tally.totals, issues: tally.issues, issueCount: tally.issueCount,
      issuesTruncated: tally.issueCount > tally.issues.length,
      qualityScore: dataQuality.score(tally.totals, dataQuality.completeness(imp.type, stats)),
      confidenceNotes: dataQuality.notes({ type: imp.type, totals: tally.totals, stats }),
      stats, processedAt: new Date(),
    });
    await imp.save();
    await dataSource.touch(imp.dataSourceId);
    return imp;
  } catch (err) {
    await repo.rollback(businessId, imp._id).catch(() => {});
    imp.status = 'FAILED';
    imp.errorMessage = err.isOperational ? err.message : 'The import stopped because of an unexpected error. Please upload the file again.';
    await imp.save().catch(() => {});
    throw err;
  }
}

async function list(businessId, query) {
  return { imports: await repo.list(businessId, query) };
}

async function get(businessId, id) {
  const imp = await repo.findById(businessId, id);
  if (!imp) throw ApiError.notFound('Import not found');
  return imp;
}

module.exports = { preview, processImport, list, get };