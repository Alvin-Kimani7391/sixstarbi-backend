const mongoose = require('mongoose');
const { Schema } = mongoose;
const { DATA_SOURCE_TYPES } = require('../constants');

const dataSourceSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    type: { type: String, enum: DATA_SOURCE_TYPES, required: true },
    name: { type: String, trim: true },
    status: { type: String, enum: ['ACTIVE', 'PAUSED', 'ERROR'], default: 'ACTIVE' },
    lastSyncAt: Date,
    config: Schema.Types.Mixed, // adapter settings for future POS and supplier connections
  },
  { timestamps: true }
);

dataSourceSchema.index({ businessId: 1, type: 1 });

module.exports = mongoose.model('DataSource', dataSourceSchema);