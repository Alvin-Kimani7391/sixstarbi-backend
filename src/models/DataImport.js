const mongoose = require('mongoose');
const { Schema } = mongoose;
const { IMPORT_TYPES } = require('../constants');

const dataImportSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: IMPORT_TYPES, required: true },
    fileName: { type: String, required: true },
    fileSize: Number,
    fileHash: { type: String, required: true },
    assetId: { type: Schema.Types.ObjectId, ref: 'Asset', required: true },
    dataSourceId: { type: Schema.Types.ObjectId, ref: 'DataSource' },
    sourceType: { type: String, enum: ['CSV', 'EXCEL'], required: true },

    status: { type: String, enum: ['PREVIEW', 'PROCESSING', 'COMPLETED', 'FAILED'], default: 'PREVIEW' },
    columns: [String],
    totalRows: Number,
    suggestedMapping: Schema.Types.Mixed,
    mapping: Schema.Types.Mixed,

    totals: {
      processed: { type: Number, default: 0 },
      valid: { type: Number, default: 0 },
      corrected: { type: Number, default: 0 },
      duplicates: { type: Number, default: 0 },
      incomplete: { type: Number, default: 0 },
    },
    issues: [{ _id: false, row: Number, field: String, severity: String, message: String }],
    issueCount: { type: Number, default: 0 },
    issuesTruncated: { type: Boolean, default: false },
    qualityScore: Number,
    confidenceNotes: [String],
    stats: Schema.Types.Mixed,
    errorMessage: String,
    processedAt: Date,
  },
  { timestamps: true }
);

dataImportSchema.index({ businessId: 1, createdAt: -1 });
dataImportSchema.index({ businessId: 1, type: 1, fileHash: 1 });

module.exports = mongoose.model('DataImport', dataImportSchema);