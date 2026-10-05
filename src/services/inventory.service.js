const repo = require('../repositories/inventory.repository');
const productRepo = require('../repositories/product.repository');
const business = require('./business.service');
const demand = require('./demand.service');
const reorder = require('./reorder.service');
const ApiError = require('../utils/ApiError');
const { meta } = require('../utils/pagination');
const { runInTransaction } = require('../utils/transaction');
const { INVENTORY_DEFAULTS: D } = require('../constants');

const DAY = 86400000;

/**
 * The single place stock changes. Never overwrites stock: it increments the balance
 * atomically and writes an audit row. Must be called with a session for multi-step operations.
 */
async function move(args, session) {
  const { businessId, productId, locationId, type, change, incomingChange = 0, damagedChange = 0,
    refType, refId, note, userId, allowNegative = false, label = 'this product' } = args;

  const inv = await repo.applyChange(
    { businessId, productId, locationId, change, incomingChange, damagedChange, allowNegative }, session
  );
  if (!inv) throw ApiError.conflict(`Not enough stock of ${label} to complete this`, 'INSUFFICIENT_STOCK');

  if (change !== 0) {
    await repo.recordTransaction(
      { businessId, productId, locationId, type, quantity: change, balanceAfter: inv.availableQuantity, refType, refId, note, userId },
      session
    );
  }
  return inv;
}

async function adjust({ user, businessId, input }) {
  const product = await productRepo.findById(businessId, input.productId);
  if (!product) throw ApiError.notFound('Product not found');
  const location = await business.resolveLocation(businessId, input.locationId);

  const q = input.quantity;
  let change = q;
  let damagedChange = 0;
  if (input.type === 'DAMAGE') { change = -Math.abs(q); damagedChange = Math.abs(q); }
  if (input.type === 'RETURN') change = Math.abs(q);

  return runInTransaction((session) =>
    move({
      businessId, productId: product._id, locationId: location._id, type: input.type, change, damagedChange,
      refType: 'Adjustment', note: input.note, userId: user._id, label: product.name,
    }, session)
  );
}

async function listStock(businessId) {
  const [products, rows, dem] = await Promise.all([
    productRepo.listAll(businessId), repo.allForBusiness(businessId), demand.getDemand(businessId),
  ]);

  const sums = new Map();
  rows.forEach((r) => {
    const k = String(r.productId);
    const s = sums.get(k) || { available: 0, reserved: 0, incoming: 0, damaged: 0 };
    s.available += r.availableQuantity; s.reserved += r.reservedQuantity;
    s.incoming += r.incomingQuantity; s.damaged += r.damagedQuantity;
    sums.set(k, s);
  });

  return products.map((p) => {
    const s = sums.get(String(p._id)) || { available: 0, reserved: 0, incoming: 0, damaged: 0 };
    const d = dem.byProduct.get(String(p._id));
    const avg = d ? d.avgDailySales : 0;
    const daysSinceLastSale = d && d.lastSaleDate && dem.asOf ? demand.daysBetween(dem.asOf, d.lastSaleDate) : null;

    const c = reorder.classify({
      available: s.available, incoming: s.incoming, avgDailySales: avg,
      leadTimeDays: p.supplierLeadTimeDays ?? D.LEAD_TIME_DAYS, safetyStock: p.safetyStock || 0,
      daysSinceLastSale, productAgeDays: Math.floor((Date.now() - new Date(p.createdAt)) / DAY),
      hasHistory: dem.hasHistory,
    });

    return {
      productId: p._id, productName: p.name, sku: p.sku,
      availableQuantity: s.available, reservedQuantity: s.reserved,
      incomingQuantity: s.incoming, damagedQuantity: s.damaged,
      averageDailySales: avg, daysOfStock: c.daysOfStock, reorderPoint: c.reorderPoint,
      stockValue: p.purchasePrice == null ? null : reorder.round(s.available * p.purchasePrice),
      reorderStatus: c.status,
    };
  });
}

async function listTransactions(businessId, { page, limit, productId }) {
  const { rows, total } = await repo.listTransactions(businessId, { page, limit, productId });
  const transactions = rows.map((t) => ({
    _id: t._id, type: t.type, quantity: t.quantity, balanceAfter: t.balanceAfter, note: t.note || '',
    refType: t.refType, createdAt: t.createdAt,
    productId: t.productId && t.productId._id, productName: t.productId ? t.productId.name : '(deleted product)',
  }));
  return { transactions, pagination: meta(page, limit, total) };
}

module.exports = { move, adjust, listStock, listTransactions };