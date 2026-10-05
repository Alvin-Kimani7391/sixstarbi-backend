const productRepo = require('../../../repositories/product.repository');
const importRepo = require('../../../repositories/import.repository');
const productService = require('../../product.service');
const { cleanRow } = require('../normalizer');
const { Tally, field, norm, buildResolver } = require('./shared');

const fields = [
  field('name', 'Product name', 'text', ['product', 'productname', 'item', 'itemname', 'name', 'description', 'itemdescription', 'title', 'goods'], { required: true, max: 200 }),
  field('sku', 'SKU', 'text', ['sku', 'code', 'itemcode', 'productcode', 'productid', 'itemid', 'stockcode', 'partnumber', 'id'], { max: 60 }),
  field('barcode', 'Barcode', 'text', ['barcode', 'upc', 'ean', 'gtin'], { max: 60 }),
  field('category', 'Category', 'text', ['category', 'productcategory', 'type', 'group', 'department'], { max: 80 }),
  field('brand', 'Brand', 'text', ['brand', 'manufacturer', 'make'], { max: 80 }),
  field('unit', 'Unit', 'text', ['unit', 'uom', 'unitofmeasure'], { max: 20 }),
  field('purchasePrice', 'Purchase price', 'number', ['purchaseprice', 'buyingprice', 'costprice', 'cost', 'unitcost', 'buyprice', 'purchasecost']),
  field('sellingPrice', 'Selling price', 'number', ['sellingprice', 'price', 'retailprice', 'saleprice', 'unitprice', 'sellprice']),
  field('safetyStock', 'Safety stock', 'number', ['safetystock', 'minstock', 'buffer']),
  field('reorderLevel', 'Reorder level', 'number', ['reorderlevel', 'reorderpoint', 'minimumstock']),
  field('targetStock', 'Target stock', 'number', ['targetstock', 'maxstock', 'maximumstock', 'parlevel']),
  field('supplierLeadTimeDays', 'Supplier lead time (days)', 'number', ['leadtime', 'leadtimedays', 'supplierleadtime', 'deliverydays']),
];

async function run({ businessId, rows }) {
  const tally = new Tally();
  const resolver = buildResolver(await productRepo.listAll(businessId));
  const seenSku = new Set(), seenName = new Set();
  const inserts = [], updates = [];
  const stats = { created: 0, updated: 0, imported: 0, missingPurchasePrice: 0, missingSellingPrice: 0, missingLeadTime: 0 };

  for (const { rowNo, vals } of rows) {
    tally.begin();
    const { out, corrected, rejected } = cleanRow(fields, vals, rowNo, tally);
    if (rejected) { tally.reject(); continue; }

    const nameKey = norm(out.name);
    if (out.sku ? seenSku.has(norm(out.sku)) : seenName.has(nameKey)) {
      tally.duplicate(rowNo, out.sku ? 'SKU' : 'Product name', `"${out.sku || out.name}" already appears earlier in this file. This row was skipped.`);
      continue;
    }
    if (out.sku) seenSku.add(norm(out.sku));
    seenName.add(nameKey);

    if (out.sellingPrice != null && out.purchasePrice != null && out.sellingPrice < out.purchasePrice) {
      tally.issue(rowNo, 'Selling price', 'LOW', 'Selling price is below the purchase price, so this product sells at a loss.');
    }

    const match = resolver.find(out.sku, out.name);
    const merged = { ...(match || {}), ...out };
    if (match) { updates.push({ id: match._id, set: out }); stats.updated += 1; }
    else { inserts.push(out); stats.created += 1; }
    stats.imported += 1;
    if (merged.purchasePrice == null) stats.missingPurchasePrice += 1;
    if (merged.sellingPrice == null) stats.missingSellingPrice += 1;
    if (merged.supplierLeadTimeDays == null) stats.missingLeadTime += 1;
    tally.ok(corrected);
  }

  const ids = await productService.reserveGlobalIds(inserts.length);
  await importRepo.insertProducts(inserts.map((p, i) => ({ ...p, businessId, globalProductId: ids[i], active: true, deleted: false })));
  await importRepo.updateProducts(businessId, updates);
  return { tally, stats };
}

module.exports = { fields, run };