const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['STORE', 'BRANCH', 'WAREHOUSE', 'ONLINE'], default: 'STORE' },
    address: { type: String, trim: true },
    isDefault: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

locationSchema.index({ businessId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Location', locationSchema);