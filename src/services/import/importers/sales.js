const mongoose = require('mongoose');
const productRepo = require('../../../repositories/product.repository');
const importRepo = require('../../../repositories/import.repository');
const { cleanRow } = require('../normalizer');
const { Tally, field, r2, buildResolver, loadLocations, pickLocation, span } = require('./shared');

const fields = [
  field('saleDate', 'Date', 'date', ['date', 'saledate', 'transactiondate', 'orderdate', 'datesold', 'invoicedate', 'day', 'timestamp', 'datetime'], { required: true }),
  field('productName', 'Product name (or SKU)', 'text', ['product', 'productname', 'item', 'itemname', 'description', 'itemdescription'], { max: 200 }),
  field('sku', 'SKU', 'text', ['sku', 'code', 'itemcode', 'productcode', 'productid', 'barcode'], { max: 60 }),
  field('quantity', 'Quantity', 'number', ['quantity', 'qty', 'units', 'soldunits', 'unitssold', 'qtysold', 'quantitysold', 'pieces'], { required: true, positive: true }),
  field('unitPrice', 'Unit price', 'number', ['unitprice', 'price', 'sellingprice', 'saleprice', 'rate', 'priceperunit']),
  field('discount', 'Discount (amount)', 'number', ['discount', 'discountamount', 'disc', 'rebate']),
  field('paymentMethod', 'Payment method', 'payment', ['paymentmethod', 'payment', 'paymenttype', 'paidby', 'paymentmode', 'tender']),
  field('receiptNo', 'Receipt / invoice no.', 'text', ['receipt', 'receiptno', 'receiptnumber', 'invoice', 'invoiceno', 'invoicenumber', 'transactionid', 'orderid', 'orderno', 'saleid', 'reference', 'txnid'], { max: 80 }),
  field('location', 'Location', 'text', ['location', 'branch', 'store', 'shop', 'outlet'], { max: 80 }),
];

async function run({ businessId, rows, ctx }) {
  const tally = new Tally();
  const [products, locs] = await Promise.all([productRepo.listAll(businessId), loadLocations(businessId)]);
  const resolver = buildResolver(products);
  const receipts = [...new Set(rows.map((r) => r.vals.receiptNo).filter((x) => x != null && String(x).trim() !== '').map((x) => String(x).trim()))];
  const existing = await importRepo.existingSaleReceipts(businessId, receipts);

  const seenLines = new Set();
  const lines = [];
  const stats = { sales: 0, lines: 0, missingCostLines: 0, unknownProducts: 0, from: null, to: null, historyDays: 0 };

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

    let unitPrice = out.unitPrice;
    if (unitPrice == null) {
      if (product.sellingPrice == null) {
        tally.rejectWith(rowNo, 'Unit price', 'No unit price in the file, and the product has no selling price.');
        continue;
      }
      unitPrice = product.sellingPrice;
      corrected = true;
      tally.issue(rowNo, 'Unit price', 'LOW', 'Unit price was missing, so the product selling price was used.');
    }

    const receipt = out.receiptNo || null;
    if (receipt && existing.has(receipt)) {
      tally.duplicate(rowNo, 'Receipt', `Receipt ${receipt} was already imported earlier. Row skipped.`);
      continue;
    }
    if (receipt) {
      const key = `${receipt}|${product._id}|${out.quantity}|${unitPrice}`;
      if (seenLines.has(key)) {
        tally.duplicate(rowNo, 'Receipt', `Receipt ${receipt} lists this same item, quantity and price twice. Row skipped.`);
        continue;
      }
      seenLines.add(key);
    }

    const loc = pickLocation(locs, out.location, rowNo, tally);
    if (loc.corrected) corrected = true;

    const gross = unitPrice * out.quantity;
    let discount = out.discount || 0;
    if (discount > gross) {
      discount = gross;
      corrected = true;
      tally.issue(rowNo, 'Discount', 'LOW', 'Discount was larger than the line total and was capped.');
    }
    const net = r2(gross - discount);
    const cost = product.purchasePrice == null ? null : r2(product.purchasePrice * out.quantity);
    if (cost == null) stats.missingCostLines += 1;

    lines.push({
      receipt, saleDate: out.saleDate, locationId: loc.locationId, productId: product._id,
      quantity: out.quantity, unitPrice, discount, net, cost, profit: cost == null ? null : r2(net - cost),
      payment: out.paymentMethod || null,
    });
    tally.ok(corrected);
  }

  const groups = new Map();
  lines.forEach((l, i) => {
    const key = l.receipt ? `r|${l.receipt}` : `x|${i}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(l);
  });

  const saleDocs = [], itemDocs = [];
  for (const g of groups.values()) {
    const _id = new mongoose.Types.ObjectId();
    const saleDate = new Date(Math.min(...g.map((l) => l.saleDate.getTime())));
    const locationId = g[0].locationId;
    saleDocs.push({
      _id, businessId, locationId, saleDate, totalAmount: r2(g.reduce((a, l) => a + l.net, 0)), itemCount: g.length,
      paymentMethod: (g.find((l) => l.payment) || {}).payment || 'OTHER', source: ctx.sourceType,
      externalId: g[0].receipt || undefined, hasMissingCost: g.some((l) => l.cost == null),
      importId: ctx.importId, userId: ctx.userId,
    });
    g.forEach((l) => itemDocs.push({
      businessId, locationId, saleId: _id, productId: l.productId, saleDate, quantity: l.quantity,
      unitPrice: l.unitPrice, discount: l.discount, cost: l.cost, profit: l.profit, importId: ctx.importId,
    }));
  }

  await importRepo.insertSales(saleDocs, itemDocs);

  const s = span(lines.map((l) => l.saleDate));
  Object.assign(stats, { sales: saleDocs.length, lines: lines.length, from: s.from, to: s.to, historyDays: s.days });
  return { tally, stats };
}

module.exports = { fields, requireOneOf: [['productName', 'sku']], run };