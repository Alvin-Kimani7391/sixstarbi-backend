const Purchase = require('../models/Purchase');
const PurchaseItem = require('../models/PurchaseItem');

module.exports = {
  createPurchase: (doc, session) => Purchase.create([doc], { session }).then((r) => r[0]),
  createItems: (docs, session) => PurchaseItem.insertMany(docs, { session }),
  findById: (businessId, id) => Purchase.findOne({ _id: id, businessId }),
  itemsFor: (businessId, purchaseId, session) =>
    PurchaseItem.find({ businessId, purchaseId }).session(session || null),

  // Only matches while still ORDERED, so a purchase can never be received twice.
  markReceived: (businessId, id, session) =>
    Purchase.findOneAndUpdate(
      { _id: id, businessId, status: 'ORDERED' },
      { $set: { status: 'RECEIVED', receivedAt: new Date() } },
      { new: true, session }
    ),

  async list(businessId, { page, limit }) {
    const [rows, total] = await Promise.all([
      Purchase.find({ businessId }).sort({ purchaseDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Purchase.countDocuments({ businessId }),
    ]);
    return { rows, total };
  },
};