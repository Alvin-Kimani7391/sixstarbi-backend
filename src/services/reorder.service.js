const { INVENTORY_DEFAULTS: D } = require('../constants');

const round = (n, d = 2) => {
  const f = 10 ** d;
  return Math.round((n + Number.EPSILON) * f) / f;
};

// Reorder Point = Average Daily Sales x Supplier Lead Time + Safety Stock
const reorderPoint = ({ avgDailySales, leadTimeDays, safetyStock = 0 }) =>
  round(avgDailySales * leadTimeDays + safetyStock);

// Days of Stock = Current Stock / Average Daily Sales
const daysOfStock = (stock, avgDailySales) => (avgDailySales > 0 ? round(stock / avgDailySales, 1) : null);

// Recommended Purchase = Target Stock - Current Stock - Incoming Stock.
// When no target is set, the reorder point is the target.
const recommendedPurchase = ({ targetStock, reorderPoint: rp, available, incoming = 0 }) =>
  Math.max(0, Math.ceil((targetStock ?? rp) - available - incoming));

function classify({ available, incoming = 0, avgDailySales, leadTimeDays, safetyStock = 0, daysSinceLastSale, productAgeDays, hasHistory }) {
  if (!hasHistory) return { status: 'NO_DATA', daysOfStock: null, reorderPoint: null };

  if (avgDailySales <= 0) {
    // A brand-new product has not had time to sell, so it is not dead stock yet.
    const neverSoldButNew = daysSinceLastSale == null && productAgeDays < D.DEAD_STOCK_DAYS;
    const dead = available > 0 && !neverSoldButNew && (daysSinceLastSale == null || daysSinceLastSale >= D.DEAD_STOCK_DAYS);
    return { status: dead ? 'DEAD' : 'OK', daysOfStock: null, reorderPoint: round(safetyStock) };
  }

  const rp = reorderPoint({ avgDailySales, leadTimeDays, safetyStock });
  const position = available + incoming;
  const coverage = position / avgDailySales;

  let status = 'OK';
  if (available <= 0 || coverage < leadTimeDays) status = 'CRITICAL';
  else if (position <= rp) status = 'REORDER';
  else if (coverage > D.OVERSTOCK_DAYS) status = 'OVERSTOCK';

  return { status, daysOfStock: daysOfStock(available, avgDailySales), reorderPoint: rp };
}

module.exports = { reorderPoint, daysOfStock, recommendedPurchase, classify, round };