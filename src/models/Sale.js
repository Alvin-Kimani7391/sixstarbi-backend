const mongoose = require('mongoose');
const { Schema } = mongoose;
const { DATA_SOURCE_TYPES, PAYMENT_METHODS } = require('../constants');

const saleSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
    saleDate: { type: Date, required: true },
    totalAmount: { type: Number, required: true, min: 0 },
    itemCount: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'CASH' },
    source: { type: String, enum: DATA_SOURCE_TYPES, default: 'MANUAL' },
    externalId: String,
    hasMissingCost: { type: Boolean, default: false }, // some lines had no purchase price, so profit is incomplete
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
        importId: { type: Schema.Types.ObjectId, ref: 'DataImport', index: true },
  },
  { timestamps: true }
);

saleSchema.index({ businessId: 1, saleDate: -1 });
saleSchema.index(
  { businessId: 1, source: 1, externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $type: 'string' } } }
);

module.exports = mongoose.model('Sale', saleSchema);