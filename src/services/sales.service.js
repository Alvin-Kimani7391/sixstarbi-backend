const productRepo = require('../repositories/product.repository');
const repo = require('../repositories/sales.repository');
const inventory = require('./inventory.service');
const business = require('./business.service');
const ApiError = require('../utils/ApiError');
const { meta } = require('../utils/pagination');
const { runInTransaction } = require('../utils/transaction');

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

async function recordSale({ user, businessId, input, source = 'MANUAL' }) {
  const location = await business.resolveLocation(businessId, input.locationId);
  const ids = [...new Set(input.items.map((i) => i.productId))];
  const products = await productRepo.findByIds(businessId, ids);
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const lines = input.items.map((i) => {
    const p = byId.get(i.productId);
    if (!p) throw ApiError.badRequest('One or more products were not found in your business', 'UNKNOWN_PRODUCT');
    const unitPrice = i.unitPrice ?? p.sellingPrice;
    if (unitPrice == null) throw ApiError.unprocessable(`Enter a unit price for ${p.name}`, 'PRICE_REQUIRED');

    const gross = unitPrice * i.quantity;
    const discount = Math.min(i.discount || 0, gross);
    const net = r2(gross - discount);
    const cost = p.purchasePrice == null ? null : r2(p.purchasePrice * i.quantity);
    return {
      product: p, productId: p._id, quantity: i.quantity, unitPrice, discount, net,
      cost, profit: cost == null ? null : r2(net - cost),
    };
  });

  const saleDate = input.saleDate || new Date();

  return runInTransaction(async (session) => {
    const sale = await repo.createSale({
      businessId, locationId: location._id, saleDate,
      totalAmount: r2(lines.reduce((a, l) => a + l.net, 0)), itemCount: lines.length,
      paymentMethod: input.paymentMethod, source,
      hasMissingCost: lines.some((l) => l.cost == null), userId: user._id,
    }, session);

    const items = await repo.createItems(lines.map((l) => ({
      businessId, locationId: location._id, saleId: sale._id, productId: l.productId, saleDate,
      quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount, cost: l.cost, profit: l.profit,
    })), session);

    for (const l of lines) {
      await inventory.move({
        businessId, productId: l.productId, locationId: location._id, type: 'SALE', change: -l.quantity,
        refType: 'Sale', refId: sale._id, userId: user._id, label: l.product.name,
      }, session);
    }
    return { sale, items };
  });
}

async function list(businessId, query) {
  const { rows, total } = await repo.list(businessId, query);
  return { sales: rows, pagination: meta(query.page, query.limit, total) };
}

async function get(businessId, id) {
  const sale = await repo.findById(businessId, id);
  if (!sale) throw ApiError.notFound('Sale not found');
  return { sale, items: await repo.itemsFor(businessId, sale._id) };
}

module.exports = { recordSale, list, get };