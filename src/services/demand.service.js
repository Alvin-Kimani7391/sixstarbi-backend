const Sale = require('../models/Sale');
const SaleItem = require('../models/SaleItem');
const { INVENTORY_DEFAULTS: D } = require('../constants');
const { oid } = require('../utils/objectId');
const { round } = require('./reorder.service');

const DAY = 86400000;
const utcDay = (d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const daysBetween = (later, earlier) => Math.floor((utcDay(later) - utcDay(earlier)) / DAY);

async function getDemand(businessId, { days = D.DEMAND_WINDOW_DAYS } = {}) {
  const biz = oid(businessId);
  const latest = await Sale.findOne({ businessId: biz }).sort({ saleDate: -1 }).select('saleDate').lean();
  if (!latest) return { hasHistory: false, asOf: null, windowDays: days, tradingDays: 0, byProduct: new Map() };

  const asOf = latest.saleDate;
  const from = new Date(utcDay(asOf) - (days - 1) * DAY);

  const [trading, units, last] = await Promise.all([
    Sale.aggregate([
      { $match: { businessId: biz, saleDate: { $gte: from } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } } } },
      { $count: 'n' },
    ]),
    SaleItem.aggregate([
      { $match: { businessId: biz, saleDate: { $gte: from } } },
      { $group: { _id: '$productId', units: { $sum: '$quantity' } } },
    ]),
    SaleItem.aggregate([
      { $match: { businessId: biz } },
      { $group: { _id: '$productId', last: { $max: '$saleDate' } } },
    ]),
  ]);

  const tradingDays = Math.max(1, (trading[0] && trading[0].n) || 1);
  const byProduct = new Map();
  last.forEach((l) => byProduct.set(String(l._id), { unitsSold: 0, avgDailySales: 0, lastSaleDate: l.last }));
  units.forEach((u) => {
    const e = byProduct.get(String(u._id)) || { lastSaleDate: null };
    e.unitsSold = u.units;
    e.avgDailySales = round(u.units / tradingDays, 3);
    byProduct.set(String(u._id), e);
  });

  return { hasHistory: true, asOf, windowDays: days, tradingDays, byProduct };
}

module.exports = { getDemand, daysBetween };