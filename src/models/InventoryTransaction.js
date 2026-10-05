const mongoose = require('mongoose');
const { Schema } = mongoose;
const { INVENTORY_TX_TYPES } = require('../constants');

const schema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
    type: { type: String, enum: INVENTORY_TX_TYPES, required: true },
    quantity: { type: Number, required: true },      // signed change to available stock
    balanceAfter: { type: Number, required: true },
    refType: String,                                  // Sale, Purchase, Adjustment...
    refId: Schema.Types.ObjectId,
    note: { type: String, trim: true, maxlength: 300 },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

schema.index({ businessId: 1, createdAt: -1 });
schema.index({ businessId: 1, productId: 1, createdAt: -1 });

module.exports = mongoose.model('InventoryTransaction', schema);