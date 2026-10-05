const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const svc = require('../services/sales.service');
const audit = require('../services/audit.service');

const list = asyncHandler(async (req, res) => ok(res, await svc.list(req.businessId, req.query)));
const get = asyncHandler(async (req, res) => ok(res, await svc.get(req.businessId, req.params.id)));

const create = asyncHandler(async (req, res) => {
  const out = await svc.recordSale({ user: req.user, businessId: req.businessId, input: req.body });
  await audit.record(req, 'SALE_RECORDED', { entityType: 'Sale', entityId: out.sale._id });
  created(res, out);
});

module.exports = { list, get, create };