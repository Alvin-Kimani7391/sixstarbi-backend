const mongoose = require('mongoose');
const productRepo = require('../../../repositories/product.repository');
const importRepo = require('../../../repositories/import.repository');
const { cleanRow } = require('../normalizer');
const { Tally, field, norm, r2, buildResolver, loadLocations, pickLocation, span } = require('./shared');

const fields = [
  field('purchaseDate', 'Date', 'date', ['date', 'purchasedate', 'orderdate', 'invoicedate', 'datereceived', 'receiveddate', 'deliverydate'], { required: true }),
  field('supplier', 'Supplier', 'text', ['supplier', 'suppliername', 'vendor', 'vendorname'], { max: 160 }),
  field('productName', 'Product name (or SKU)', 'text', ['product', 'productname', 'item', 'itemname', 'description'], { max: 200 }),
  field('sku', 'SKU', 'text', ['sku', 'code', 'itemcode', 'productcode', 'productid', 'barcode'], { max: 60 }),
  field('quantity', 'Quantity', 'number', ['quantity', 'qty', 'units', 'qtybought', 'quantitypurchased', 'qtyordered'], { required: true, positive: true }),
  field('unitCost', 'Unit cost', 'number', ['unitcost', 'cost', 'costprice', 'purchaseprice', 'buyingprice', 'price', 'rate', 'unitprice'], { required: true }),
  field('receiptNo', 'Invoice / PO no.', 'text', ['invoice', 'invoiceno', 'invoicenumber', 'reference', 'ponumber', 'po', 'purchaseorder', 'grn', 'receipt', 'orderno'], { max: 80 }),
  field('location', 'Location', 'text', ['location', 'branch', 'store', 'shop', 'warehouse'], { max: 80 }),
];

const dayKey = (d) => d.toISOString().slice(0, 10);

async function run({ businessId, rows, ctx }) {
  const tally = new Tally();
  const [products, locs] = await Promise.all([productRepo.listAll(businessId), loadLocations(businessId)]);
  const resolver = buildResolver(products);
  const receipts = [...new Set(rows.map((r) => r.vals.receiptNo).filter((x) => x != null && String(x).trim() !== '').map((x) => String(x).trim()))];
  const existing = await importRepo.existingPurchaseReceipts(businessId, receipts);

  const seenLines = new Set();
  const lines = [];
  const stats = { purchases: 0, lines: 0, unknownProducts: 0, backfilledCosts: 0, from: null, to: null, historyDays: 0 };

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

    const receipt = out.receiptNo || null;
    if (receipt && existing.has(receipt)) {
      tally.duplicate(rowNo, 'Invoice', `Invoice ${receipt} was already imported earlier. Row skipped.`);
      continue;
    }
    if (receipt) {
      const key = `${receipt}|${product._id}|${out.quantity}|${out.unitCost}`;
      if (seenLines.has(key)) {
        tally.duplicate(rowNo, 'Invoice', `Invoice ${receipt} lists this same item, quantity and cost twice. Row skipped.`);
        continue;
      }
      seenLines.add(key);
    }

    const loc = pickLocation(locs, out.location, rowNo, tally);
    if (loc.corrected) corrected = true;

    lines.push({
      receipt, supplier: out.supplier || null, purchaseDate: out.purchaseDate, locationId: loc.locationId,
      productId: product._id, hadCost: product.purchasePrice != null, quantity: out.quantity, unitCost: out.unitCost,
    });
    tally.ok(corrected);
  }

  const groups = new Map();
  lines.forEach((l) => {
    const key = l.receipt ? `r|${l.receipt}` : `s|${norm(l.supplier || '')}|${dayKey(l.purchaseDate)}|${l.locationId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(l);
  });

  const purchaseDocs = [], itemDocs = [];
  for (const g of groups.values()) {
    const _id = new mongoose.Types.ObjectId();
    const purchaseDate = new Date(Math.min(...g.map((l) => l.purchaseDate.getTime())));
    purchaseDocs.push({
      _id, businessId, locationId: g[0].locationId, supplierName: g[0].supplier || undefined, purchaseDate,
      totalCost: r2(g.reduce((a, l) => a + l.quantity * l.unitCost, 0)), itemCount: g.length,
      status: 'RECEIVED', receivedAt: purchaseDate, source: ctx.sourceType,
      externalId: g[0].receipt || undefined, importId: ctx.importId, userId: ctx.userId,
    });
    g.forEach((l) => itemDocs.push({
      businessId, purchaseId: _id, productId: l.productId, purchaseDate,
      quantity: l.quantity, unitCost: l.unitCost, importId: ctx.importId,
    }));
  }
  await importRepo.insertPurchases(purchaseDocs, itemDocs);

  // Fill empty purchase prices from the most recent cost in this file.
  const latest = new Map();
  lines.forEach((l) => {
    if (l.hadCost) return;
    const k = String(l.productId);
    const cur = latest.get(k);
    if (!cur || l.purchaseDate >= cur.date) latest.set(k, { id: l.productId, date: l.purchaseDate, unitCost: l.unitCost });
  });
  await importRepo.backfillCosts(businessId, [...latest.values()]);

  const s = span(lines.map((l) => l.purchaseDate));
  Object.assign(stats, { purchases: purchaseDocs.length, lines: lines.length, backfilledCosts: latest.size, from: s.from, to: s.to, historyDays: s.days });
  return { tally, stats };
}

module.exports = { fields, requireOneOf: [['productName', 'sku']], run };