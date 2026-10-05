const mongoose = require('mongoose');
const { Schema } = mongoose;

const assetSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    folder: { type: String, required: true },
    resourceType: { type: String, enum: ['image', 'raw'], required: true },
    cloudinaryUrl: { type: String, required: true },
    cloudinaryPublicId: { type: String, required: true },
    fileName: { type: String, required: true },
    fileSize: Number,
    mimeType: String,
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

assetSchema.index({ businessId: 1, uploadedAt: -1 });
assetSchema.index({ cloudinaryPublicId: 1 }, { unique: true });

module.exports = mongoose.model('Asset', assetSchema);