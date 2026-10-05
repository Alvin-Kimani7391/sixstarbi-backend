const mongoose = require('mongoose');
const { Schema } = mongoose;

const purchaseItemSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    purchaseId: { type: Schema.Types.ObjectId, ref: 'Purchase', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    purchaseDate: { type: Date, required: true },
    quantity: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
        importId: { type: Schema.Types.ObjectId, ref: 'DataImport', index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

purchaseItemSchema.index({ businessId: 1, productId: 1, purchaseDate: -1 });

module.exports = mongoose.model('PurchaseItem', purchaseItemSchema);