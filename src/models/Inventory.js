const mongoose = require('mongoose');
const { Schema } = mongoose;

const inventorySchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
    availableQuantity: { type: Number, default: 0 },
    reservedQuantity: { type: Number, default: 0 },
    incomingQuantity: { type: Number, default: 0 },
    damagedQuantity: { type: Number, default: 0 },
  },
  { timestamps: true }
);

inventorySchema.index({ businessId: 1, productId: 1, locationId: 1 }, { unique: true });

module.exports = mongoose.model('Inventory', inventorySchema);