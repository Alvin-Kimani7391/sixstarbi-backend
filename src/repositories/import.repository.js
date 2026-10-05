const DataImport = require('../models/DataImport');
const Sale = require('../models/Sale');
const SaleItem = require('../models/SaleItem');
const Purchase = require('../models/Purchase');
const PurchaseItem = require('../models/PurchaseItem');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const InventoryTransaction = require('../models/InventoryTransaction');
const { IMPORT_LIMITS: L } = require('../constants');

const chunks = (arr, n = L.CHUNK) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};
const insertChunked = async (Model, docs, opts) => {
  for (const c of chunks(docs)) await Model.insertMany(c, opts);
};
const existingReceipts = async (Model, businessId, receipts) => {
  if (!receipts.length) return new Set();
  const rows = await Model.find({ businessId, source: { $in: ['CSV', 'EXCEL'] }, externalId: { $in: receipts } })
    .select('externalId').lean();
  return new Set(rows.map((r) => r.externalId));
};

module.exports = {
  create: (data) => DataImport.create(data),
  findById: (businessId, id) => DataImport.findOne({ _id: id, businessId }),
  isAssetInUse: (businessId, assetId) => DataImport.exists({ businessId, assetId }),

  // Atomic PREVIEW -> PROCESSING, so one import can never run twice.
  claim: (businessId, id) =>
    DataImport.findOneAndUpdate({ _id: id, businessId, status: 'PREVIEW' }, { $set: { status: 'PROCESSING' } }, { new: true }),

  findCompletedByHash: (businessId, type, fileHash) =>
    DataImport.findOne({ businessId, type, fileHash, status: 'COMPLETED' }).select('createdAt fileName'),

  list: (businessId, { limit, status }) =>
    DataImport.find({ businessId, status: status || { $ne: 'PREVIEW' } })
      .select('-issues -suggestedMapping -mapping -columns')
      .sort({ createdAt: -1 }).limit(limit).lean(),

  existingSaleReceipts: (b, r) => existingReceipts(Sale, b, r),
  existingPurchaseReceipts: (b, r) => existingReceipts(Purchase, b, r),

  insertSales: async (sales, items) => {
    await insertChunked(Sale, sales);
    await insertChunked(SaleItem, items);
  },
  insertPurchases: async (purchases, items) => {
    await insertChunked(Purchase, purchases);
    await insertChunked(PurchaseItem, items);
  },
  // Imported history can be removed completely if an import fails.
  async rollback(businessId, importId) {
    const f = { businessId, importId };
    await Promise.all([Sale.deleteMany(f), SaleItem.deleteMany(f), Purchase.deleteMany(f), PurchaseItem.deleteMany(f)]);
  },

  insertProducts: (docs) => insertChunked(Product, docs, { ordered: false }),
  async updateProducts(businessId, updates) {
    for (const c of chunks(updates)) {
      await Product.bulkWrite(c.map((u) => ({
        updateOne: { filter: { _id: u.id, businessId, deleted: false }, update: { $set: u.set } },
      })));
    }
  },
  // Only fills a purchase price that is still empty.
  async backfillCosts(businessId, items) {
    for (const c of chunks(items)) {
      await Product.bulkWrite(c.map((u) => ({
        updateOne: {
          filter: { _id: u.id, businessId, deleted: false, purchasePrice: null },
          update: { $set: { purchasePrice: u.unitCost } },
        },
      })));
    }
  },

  currentStock: (businessId) => Inventory.find({ businessId }).select('productId locationId availableQuantity').lean(),
  async applyStockCount(ops, txs, session) {
    for (const c of chunks(ops)) await Inventory.bulkWrite(c, { session });
    for (const c of chunks(txs)) await InventoryTransaction.insertMany(c, { session });
  },
};