const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const svc = require('../services/import.service');
const audit = require('../services/audit.service');
const notification = require('../services/notification.service');

const preview = asyncHandler(async (req, res) => {
  const out = await svc.preview({ user: req.user, businessId: req.businessId, type: req.params.type, file: req.file });
  await audit.record(req, 'IMPORT_PREVIEWED', { entityType: 'DataImport', entityId: out.importId, metadata: { type: req.params.type } });
  ok(res, out);
});

const processImport = asyncHandler(async (req, res) => {
  const imp = await svc.processImport({ user: req.user, businessId: req.businessId, id: req.params.id, mapping: req.body.mapping });
  await audit.record(req, 'IMPORT_COMPLETED', {
    entityType: 'DataImport', entityId: imp._id,
    metadata: { type: imp.type, qualityScore: imp.qualityScore, totals: imp.totals },
  });
  notification.sendImportCompleted(req.user, { qualityScore: imp.qualityScore, processed: imp.totals.processed }); // fire-and-forget
  ok(res, { import: imp });
});

const list = asyncHandler(async (req, res) => ok(res, await svc.list(req.businessId, req.query)));
const get = asyncHandler(async (req, res) => ok(res, { import: await svc.get(req.businessId, req.params.id) }));

module.exports = { preview, process: processImport, list, get };