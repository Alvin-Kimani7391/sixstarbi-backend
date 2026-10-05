const repo = require('../repositories/product.repository');
const Counter = require('../models/Counter');
const ApiError = require('../utils/ApiError');
const { meta } = require('../utils/pagination');

async function nextGlobalProductId() {
  const c = await Counter.findOneAndUpdate({ _id: 'globalProductId' }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return `SS-PROD-${String(c.seq).padStart(6, '0')}`;
}

async function assertSkuFree(businessId, sku, exceptId) {
  if (!sku) return;
  const found = await repo.findBySku(businessId, sku);
  if (found && String(found._id) !== String(exceptId)) {
    throw ApiError.conflict(`Another product already uses SKU "${sku}"`, 'SKU_TAKEN');
  }
}

async function create(businessId, input) {
  await assertSkuFree(businessId, input.sku);
  return repo.create({ ...input, businessId, globalProductId: await nextGlobalProductId() });
}

async function list(businessId, { page, limit, search }) {
  const { items, total } = await repo.search(businessId, { page, limit, search });
  return { products: items, pagination: meta(page, limit, total) };
}

async function get(businessId, id) {
  const p = await repo.findById(businessId, id);
  if (!p) throw ApiError.notFound('Product not found');
  return p;
}

async function update(businessId, id, updates) {
  await assertSkuFree(businessId, updates.sku, id);
  const p = await repo.update(businessId, id, updates);
  if (!p) throw ApiError.notFound('Product not found');
  return p;
}

async function remove(businessId, id) {
  const p = await repo.softDelete(businessId, id);
  if (!p) throw ApiError.notFound('Product not found');
}

async function reserveGlobalIds(n) {
  if (n <= 0) return [];
  const c = await Counter.findOneAndUpdate({ _id: 'globalProductId' }, { $inc: { seq: n } }, { new: true, upsert: true });
  return Array.from({ length: n }, (_, i) => `SS-PROD-${String(c.seq - n + 1 + i).padStart(6, '0')}`);
}


module.exports = { create, list, get, update, remove, reserveGlobalIds };

