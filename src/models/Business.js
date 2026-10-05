const mongoose = require('mongoose');
const { DATA_PREFERENCES } = require('../constants');

const businessSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    businessType: { type: String, trim: true },
    industry: { type: String, trim: true },
    country: { type: String, trim: true, default: 'Kenya' },
    currency: { type: String, trim: true, uppercase: true, default: 'KES' },
    numberOfLocations: { type: Number, min: 1, default: 1 },
    existingPOS: { type: String, trim: true },
    existingInventorySystem: { type: String, trim: true },
    dataPreference: { type: String, enum: DATA_PREFERENCES, default: 'HAVE_DATA' },

    logo: {
      cloudinaryUrl: String,
      cloudinaryPublicId: String,
    },

    onboardingCompleted: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Business', businessSchema);