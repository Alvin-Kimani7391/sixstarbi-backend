const mongoose = require('mongoose');
const { Schema } = mongoose;
const { DATA_SOURCE_TYPES } = require('../constants');

const purchaseSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
    supplierId: { type: Schema.Types.ObjectId },           // linked in Phase 9
    supplierName: { type: String, trim: true, maxlength: 160 },
    purchaseDate: { type: Date, required: true },
    totalCost: { type: Number, required: true, min: 0 },
    itemCount: { type: Number, default: 0 },
    status: { type: String, enum: ['ORDERED', 'RECEIVED'], default: 'RECEIVED' },
    receivedAt: Date,
    source: { type: String, enum: DATA_SOURCE_TYPES, default: 'MANUAL' },
    externalId: String,
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
        importId: { type: Schema.Types.ObjectId, ref: 'DataImport', index: true },
  },
  { timestamps: true }
);

purchaseSchema.index({ businessId: 1, purchaseDate: -1 });
purchaseSchema.index(
  { businessId: 1, source: 1, externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $type: 'string' } } }
);

module.exports = mongoose.model('Purchase', purchaseSchema);