const productRepo = require('../repositories/product.repository');
const repo = require('../repositories/purchase.repository');
const inventory = require('./inventory.service');
const business = require('./business.service');
const ApiError = require('../utils/ApiError');
const { meta } = require('../utils/pagination');
const { runInTransaction } = require('../utils/transaction');

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

async function recordPurchase({ user, businessId, input, source = 'MANUAL' }) {
  const location = await business.resolveLocation(businessId, input.locationId);
  const ids = [...new Set(input.items.map((i) => i.productId))];
  const products = await productRepo.findByIds(businessId, ids);
  const byId = new Map(products.map((p) => [String(p._id), p]));
  input.items.forEach((i) => {
    if (!byId.has(i.productId)) throw ApiError.badRequest('One or more products were not found in your business', 'UNKNOWN_PRODUCT');
  });

  const purchaseDate = input.purchaseDate || new Date();
  const received = input.status === 'RECEIVED';

  return runInTransaction(async (session) => {
    const purchase = await repo.createPurchase({
      businessId, locationId: location._id, supplierName: input.supplierName, purchaseDate,
      totalCost: r2(input.items.reduce((a, i) => a + i.quantity * i.unitCost, 0)), itemCount: input.items.length,
      status: input.status, receivedAt: received ? new Date() : undefined, source, userId: user._id,
    }, session);

    const items = await repo.createItems(input.items.map((i) => ({
      businessId, purchaseId: purchase._id, productId: i.productId, purchaseDate,
      quantity: i.quantity, unitCost: i.unitCost,
    })), session);

    for (const i of input.items) {
      await inventory.move({
        businessId, productId: i.productId, locationId: location._id, type: 'PURCHASE',
        change: received ? i.quantity : 0, incomingChange: received ? 0 : i.quantity,
        refType: 'Purchase', refId: purchase._id, userId: user._id, label: byId.get(i.productId).name,
      }, session);
    }
    return { purchase, items };
  });
}

/** Moves an ORDERED purchase into stock: incoming goes down, available goes up. */
async function receivePurchase({ user, businessId, id }) {
  return runInTransaction(async (session) => {
    const purchase = await repo.markReceived(businessId, id, session);
    if (!purchase) throw ApiError.conflict('This purchase does not exist or was already received', 'NOT_RECEIVABLE');
    const items = await repo.itemsFor(businessId, purchase._id, session);
    for (const i of items) {
      await inventory.move({
        businessId, productId: i.productId, locationId: purchase.locationId, type: 'PURCHASE',
        change: i.quantity, incomingChange: -i.quantity, refType: 'Purchase', refId: purchase._id, userId: user._id,
      }, session);
    }
    return purchase;
  });
}

async function list(businessId, query) {
  const { rows, total } = await repo.list(businessId, query);
  return { purchases: rows, pagination: meta(query.page, query.limit, total) };
}

async function get(businessId, id) {
  const purchase = await repo.findById(businessId, id);
  if (!purchase) throw ApiError.notFound('Purchase not found');
  return { purchase, items: await repo.itemsFor(businessId, purchase._id) };
}

module.exports = { recordPurchase, receivePurchase, list, get };