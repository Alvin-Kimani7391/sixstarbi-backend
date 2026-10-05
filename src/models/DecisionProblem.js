const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    title: { type: String, required: true, trim: true },
    inputs: { type: mongoose.Schema.Types.Mixed, required: true },
    result: { type: mongoose.Schema.Types.Mixed, required: true },
    explanation: {
      text: String,
      source: { type: String, enum: ['gemini', 'fallback'] },
      generatedAt: Date,
    },
  },
  { timestamps: true }
);

schema.index({ businessId: 1, createdAt: -1 });

module.exports = mongoose.model('DecisionProblem', schema);