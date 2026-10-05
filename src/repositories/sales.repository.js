const Sale = require('../models/Sale');
const SaleItem = require('../models/SaleItem');

module.exports = {
  createSale: (doc, session) => Sale.create([doc], { session }).then((r) => r[0]),
  createItems: (docs, session) => SaleItem.insertMany(docs, { session }),
  findById: (businessId, id) => Sale.findOne({ _id: id, businessId }),
  itemsFor: (businessId, saleId) =>
    SaleItem.find({ businessId, saleId }).populate('productId', 'name sku').lean(),

  async list(businessId, { page, limit, from, to }) {
    const filter = { businessId };
    if (from || to) {
      filter.saleDate = {};
      if (from) filter.saleDate.$gte = from;
      if (to) filter.saleDate.$lte = to;
    }
    const [rows, total] = await Promise.all([
      Sale.find(filter).sort({ saleDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Sale.countDocuments(filter),
    ]);
    return { rows, total };
  },
};