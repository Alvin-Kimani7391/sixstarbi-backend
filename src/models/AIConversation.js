const mongoose = require('mongoose');
const { Schema } = mongoose;

const schema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, trim: true, maxlength: 80 },
    messages: [{
      _id: false,
      role: { type: String, enum: ['user', 'assistant'], required: true },
      content: { type: String, required: true, maxlength: 8000 },
      source: String,
      createdAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true }
);

schema.index({ businessId: 1, createdAt: -1 });
schema.index({ businessId: 1, userId: 1, updatedAt: -1 });

module.exports = mongoose.model('AIConversation', schema);