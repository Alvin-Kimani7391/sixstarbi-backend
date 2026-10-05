const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const ApiError = require('../utils/ApiError');
const svc = require('../services/upload.service');
const audit = require('../services/audit.service');

const create = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Choose a file to upload', 'FILE_REQUIRED');
  const asset = await svc.upload({ user: req.user, businessId: req.businessId, folder: req.body.folder, file: req.file });
  await audit.record(req, 'FILE_UPLOADED', {
    entityType: 'Asset', entityId: asset._id, metadata: { folder: req.body.folder, fileName: asset.fileName },
  });
  created(res, { upload: asset });
});

const remove = asyncHandler(async (req, res) => {
  await svc.remove(req.businessId, req.params.id);
  await audit.record(req, 'FILE_DELETED', { entityType: 'Asset', entityId: req.params.id });
  ok(res, { message: 'Deleted' });
});

module.exports = { create, remove };