const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const svc = require('../services/product.service');
const audit = require('../services/audit.service');

const list = asyncHandler(async (req, res) => ok(res, await svc.list(req.businessId, req.query)));
const get = asyncHandler(async (req, res) => ok(res, { product: await svc.get(req.businessId, req.params.id) }));

const create = asyncHandler(async (req, res) => {
  const product = await svc.create(req.businessId, req.body);
  await audit.record(req, 'PRODUCT_CREATED', { entityType: 'Product', entityId: product._id });
  created(res, { product });
});

const update = asyncHandler(async (req, res) => {
  const product = await svc.update(req.businessId, req.params.id, req.body);
  await audit.record(req, 'PRODUCT_UPDATED', { entityType: 'Product', entityId: product._id });
  ok(res, { product });
});

const remove = asyncHandler(async (req, res) => {
  await svc.remove(req.businessId, req.params.id);
  await audit.record(req, 'PRODUCT_DELETED', { entityType: 'Product', entityId: req.params.id });
  ok(res, { message: 'Deleted' });
});

module.exports = { list, get, create, update, remove };