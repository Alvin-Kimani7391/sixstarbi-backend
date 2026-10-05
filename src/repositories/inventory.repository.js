const Inventory = require('../models/Inventory');
const InventoryTransaction = require('../models/InventoryTransaction');

module.exports = {
  allForBusiness: (businessId) => Inventory.find({ businessId }).lean(),

  /**
   * Atomic stock change. A decrease only matches when enough stock exists,
   * so two simultaneous sales can never oversell. Returns null when stock is insufficient.
   */
  applyChange({ businessId, productId, locationId, change, incomingChange, damagedChange, allowNegative }, session) {
    const filter = { businessId, productId, locationId };
    const mayCreate = change >= 0 || allowNegative;
    if (!mayCreate) filter.availableQuantity = { $gte: -change };
    return Inventory.findOneAndUpdate(
      filter,
      { $inc: { availableQuantity: change, incomingQuantity: incomingChange, damagedQuantity: damagedChange } },
      { new: true, upsert: mayCreate, session }
    );
  },

  recordTransaction: (doc, session) => InventoryTransaction.create([doc], { session }).then((r) => r[0]),

  async listTransactions(businessId, { page, limit, productId }) {
    const filter = { businessId };
    if (productId) filter.productId = productId;
    const [rows, total] = await Promise.all([
      InventoryTransaction.find(filter)
        .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
        .populate('productId', 'name').lean(),
      InventoryTransaction.countDocuments(filter),
    ]);
    return { rows, total };
  },
};