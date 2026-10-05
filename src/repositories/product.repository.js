const Product = require('../models/Product');

const scope = (businessId) => ({ businessId, deleted: false });
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = {
  create: (data) => Product.create(data),
  findById: (businessId, id) => Product.findOne({ _id: id, ...scope(businessId) }),
  findByIds: (businessId, ids) => Product.find({ _id: { $in: ids }, ...scope(businessId) }),
  findBySku: (businessId, sku) => Product.findOne({ sku, ...scope(businessId) }),
  listAll: (businessId) => Product.find(scope(businessId)).sort({ name: 1 }).lean(),

  async search(businessId, { page, limit, search }) {
    const filter = scope(businessId);
    if (search) {
      const re = new RegExp(escapeRe(search), 'i');
      filter.$or = [{ name: re }, { sku: re }, { category: re }, { barcode: re }];
    }
    const [items, total] = await Promise.all([
      Product.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit),
      Product.countDocuments(filter),
    ]);
    return { items, total };
  },

  update: (businessId, id, updates) =>
    Product.findOneAndUpdate({ _id: id, ...scope(businessId) }, { $set: updates }, { new: true, runValidators: true }),

  softDelete: (businessId, id) =>
    Product.findOneAndUpdate({ _id: id, ...scope(businessId) }, { $set: { deleted: true, active: false } }, { new: true }),
};