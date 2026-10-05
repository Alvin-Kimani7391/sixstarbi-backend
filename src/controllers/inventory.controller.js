const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const svc = require('../services/inventory.service');
const audit = require('../services/audit.service');

const stock = asyncHandler(async (req, res) => ok(res, { items: await svc.listStock(req.businessId) }));
const transactions = asyncHandler(async (req, res) => ok(res, await svc.listTransactions(req.businessId, req.query)));

const adjust = asyncHandler(async (req, res) => {
  const inv = await svc.adjust({ user: req.user, businessId: req.businessId, input: req.body });
  await audit.record(req, 'STOCK_ADJUSTED', {
    entityType: 'Product', entityId: req.body.productId, metadata: { type: req.body.type, quantity: req.body.quantity },
  });
  ok(res, { inventory: inv });
});

module.exports = { stock, transactions, adjust };