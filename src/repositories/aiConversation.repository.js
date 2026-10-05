const AIConversation = require('../models/AIConversation');

// Conversations are private to the user within their business.
module.exports = {
  create: (data) => AIConversation.create(data),
  findOwn: (businessId, userId, id) => AIConversation.findOne({ _id: id, businessId, userId }),
  listOwn: (businessId, userId, limit = 30) =>
    AIConversation.find({ businessId, userId }).sort({ updatedAt: -1 }).limit(limit).lean(),
  append: (businessId, userId, id, messages) =>
    AIConversation.updateOne(
      { _id: id, businessId, userId },
      { $push: { messages: { $each: messages, $slice: -100 } } }
    ),
};