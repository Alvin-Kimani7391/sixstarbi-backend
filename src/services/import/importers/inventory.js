const productRepo = require('../../../repositories/product.repository');
const importRepo = require('../../../repositories/import.repository');
const { runInTransaction } = require('../../../utils/transaction');
const { cleanRow } = require('../normalizer');
const { Tally, field, buildResolver, loadLocations, pickLocation } = require('./shared');

const fields = [
  field('productName', 'Product name (or SKU)', 'text', ['product', 'productname', 'item', 'itemname', 'description'], { max: 200 }),
  field('sku', 'SKU', 'text', ['sku', 'code', 'itemcode', 'productcode', 'productid', 'barcode'], { max: 60 }),
  field('quantity', 'Quantity on hand', 'number', ['quantity', 'qty', 'stock', 'onhand', 'quantityonhand', 'qtyonhand', 'currentstock', 'stockonhand', 'balance', 'available', 'instock'], { required: true }),
  field('location', 'Location', 'text', ['location', 'branch', 'store', 'shop', 'warehouse'], { max: 80 }),
];

async function run({ businessId, rows, ctx }) {
  const tally = new Tally();
  const [products, locs] = await Promise.all([productRepo.listAll(businessId), loadLocations(businessId)]);
  const resolver = buildResolver(products);
  const seen = new Set();
  const targets = [];
  const stats = { counted: 0, adjusted: 0, unchanged: 0, unknownProducts: 0 };

  for (const { rowNo, vals } of rows) {
    tally.begin();
    const { out, corrected: c0, rejected } = cleanRow(fields, vals, rowNo, tally);
    if (rejected) { tally.reject(); continue; }
    let corrected = c0;

    if (!out.productName && !out.sku) { tally.rejectWith(rowNo, 'Product', 'Product name or SKU is missing.'); continue; }
    const product = resolver.find(out.sku, out.productName);
    if (!product) {
      stats.unknownProducts += 1;
      tally.rejectWith(rowNo, 'Product', `Unknown product "${out.productName || out.sku}". Import your products first.`);
      continue;
    }
    const loc = pickLocation(locs, out.location, rowNo, tally);
    if (loc.corrected) corrected = true;

    const key = `${product._id}|${loc.locationId}`;
    if (seen.has(key)) {
      tally.duplicate(rowNo, 'Product', `"${product.name}" already has a stock count earlier in this file. The first value was kept.`);
      continue;
    }
    seen.add(key);
    targets.push({ productId: product._id, locationId: loc.locationId, qty: out.quantity });
    tally.ok(corrected);
  }

  const current = new Map((await importRepo.currentStock(businessId)).map((r) => [`${r.productId}|${r.locationId}`, r.availableQuantity || 0]));
  const ops = [], txs = [];
  for (const t of targets) {
    const delta = t.qty - (current.get(`${t.productId}|${t.locationId}`) || 0);
    if (delta === 0) { stats.unchanged += 1; continue; }
    ops.push({
      updateOne: {
        filter: { businessId, productId: t.productId, locationId: t.locationId },
        update: { $inc: { availableQuantity: delta } },
        upsert: true,
      },
    });
    txs.push({
      businessId, productId: t.productId, locationId: t.locationId, type: 'ADJUSTMENT', quantity: delta,
      balanceAfter: t.qty, refType: 'Import', refId: ctx.importId, note: 'Stock count from import', userId: ctx.userId,
    });
  }
  await runInTransaction((session) => importRepo.applyStockCount(ops, txs, session));

  Object.assign(stats, { counted: targets.length, adjusted: ops.length });
  return { tally, stats };
}

module.exports = { fields, requireOneOf: [['productName', 'sku']], run };