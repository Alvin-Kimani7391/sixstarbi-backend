const mongoose = require('mongoose');
const { Schema } = mongoose;

// businessId, locationId and saleDate are copied from the sale so analytics can query items directly.
const saleItemSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
    saleId: { type: Schema.Types.ObjectId, ref: 'Sale', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    saleDate: { type: Date, required: true },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },   // total discount on this line
    cost: { type: Number, default: null },            // total cost of this line; null when unknown
    profit: { type: Number, default: null },          // line total - cost; null when cost unknown
        importId: { type: Schema.Types.ObjectId, ref: 'DataImport', index: true }, 
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

saleItemSchema.index({ businessId: 1, productId: 1, saleDate: -1 });
saleItemSchema.index({ businessId: 1, saleDate: -1 });

module.exports = mongoose.model('SaleItem', saleItemSchema);