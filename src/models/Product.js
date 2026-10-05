const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    globalProductId: { type: String },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    sku: { type: String, trim: true },
    barcode: { type: String, trim: true },
    category: { type: String, trim: true },
    brand: { type: String, trim: true },
    unit: { type: String, trim: true, default: 'pcs' },
    purchasePrice: { type: Number, min: 0 },
    sellingPrice: { type: Number, min: 0 },
    safetyStock: { type: Number, min: 0, default: 0 },
    reorderLevel: { type: Number, min: 0 },
    targetStock: { type: Number, min: 0 },
    supplierLeadTimeDays: { type: Number, min: 0 },
    active: { type: Boolean, default: true },
    deleted: { type: Boolean, default: false },
    imageUrl: String,
    cloudinaryPublicId: String,
    externalIds: [{ _id: false, source: String, id: String }],
  },
  { timestamps: true }
);

productSchema.index(
  { businessId: 1, sku: 1 },
  { unique: true, partialFilterExpression: { sku: { $type: 'string' }, deleted: false } }
);
productSchema.index({ businessId: 1, name: 1 });
productSchema.index({ globalProductId: 1 }, { unique: true, sparse: true });
productSchema.index({ businessId: 1, 'externalIds.source': 1, 'externalIds.id': 1 });

module.exports = mongoose.model('Product', productSchema);