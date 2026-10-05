const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const svc = require('../services/purchase.service');
const audit = require('../services/audit.service');

const list = asyncHandler(async (req, res) => ok(res, await svc.list(req.businessId, req.query)));
const get = asyncHandler(async (req, res) => ok(res, await svc.get(req.businessId, req.params.id)));

const create = asyncHandler(async (req, res) => {
  const out = await svc.recordPurchase({ user: req.user, businessId: req.businessId, input: req.body });
  await audit.record(req, 'PURCHASE_RECORDED', { entityType: 'Purchase', entityId: out.purchase._id });
  created(res, out);
});

const receive = asyncHandler(async (req, res) => {
  const purchase = await svc.receivePurchase({ user: req.user, businessId: req.businessId, id: req.params.id });
  await audit.record(req, 'PURCHASE_RECEIVED', { entityType: 'Purchase', entityId: purchase._id });
  ok(res, { purchase });
});

module.exports = { list, get, create, receive };