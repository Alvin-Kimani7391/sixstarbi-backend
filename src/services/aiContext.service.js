const Business = require('../models/Business');
const SaleItem = require('../models/SaleItem');
const productRepo = require('../repositories/product.repository');
const inventory = require('./inventory.service');
const demand = require('./demand.service');
const reorder = require('./reorder.service');
const { INVENTORY_DEFAULTS: D } = require('../constants');
const { oid } = require('../utils/objectId');

const DAY = 86400000;
const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const PRIORITY = { HIGH: 0, MEDIUM: 1, LOW: 2 };

const LINE = { $subtract: [{ $multiply: ['$unitPrice', '$quantity'] }, { $ifNull: ['$discount', 0] }] };
const NO_COST = { $eq: [{ $ifNull: ['$profit', null] }, null] };

const salesByProduct = (businessId, from, to) =>
  SaleItem.aggregate([
    { $match: { businessId: oid(businessId), saleDate: { $gte: from, $lte: to } } },
    { $group: {
      _id: '$productId',
      units: { $sum: '$quantity' },
      revenue: { $sum: LINE },
      profit: { $sum: { $ifNull: ['$profit', 0] } },
      costedRevenue: { $sum: { $cond: [NO_COST, 0, LINE] } },
      lines: { $sum: 1 },
      unknownCostLines: { $sum: { $cond: [NO_COST, 1, 0] } },
    } },
  ]);

const sums = (rows) => rows.reduce((a, r) => ({
  revenue: a.revenue + r.revenue, profit: a.profit + r.profit, units: a.units + r.units,
  costedRevenue: a.costedRevenue + r.costedRevenue, unknownCostLines: a.unknownCostLines + r.unknownCostLines, lines: a.lines + r.lines,
}), { revenue: 0, profit: 0, units: 0, costedRevenue: 0, unknownCostLines: 0, lines: 0 });

const growth = (cur, prev) => (prev > 0 ? r1(((cur - prev) / prev) * 100) : null);

/** Interim rule-based recommendation using the spec formulas. Batch 4's recommendation.service replaces this. */
function recommend(r, facts) {
  let confidence = 0.9;
  const assumptions = [];
  if (r.leadTimeAssumed) { confidence -= 0.15; assumptions.push(`No supplier lead time is set, so ${D.LEAD_TIME_DAYS} days was assumed.`); }
  if (facts.tradingDays < 14) { confidence -= 0.2; assumptions.push(`Only ${facts.tradingDays} trading day(s) of sales in the last ${facts.windowDays} days.`); }
  if (r.purchasePrice == null) { confidence -= 0.1; assumptions.push('No purchase price, so capital and profit figures are incomplete.'); }
  confidence = Math.max(0.3, r2(confidence));

  const base = {
    productId: r.productId, productName: r.name, currentStock: r.stock, incomingStock: r.incoming,
    averageDailySales: r.avgDailySales, daysOfStock: r.daysOfStock, leadTimeDays: r.leadTimeDays,
    safetyStock: r.safetyStock, reorderPoint: r.reorderPoint, confidence, assumptions, status: 'PENDING',
  };

  if (r.status === 'CRITICAL' || r.status === 'REORDER') {
    const qty = reorder.recommendedPurchase({ targetStock: r.targetStock, reorderPoint: r.reorderPoint, available: r.stock, incoming: r.incoming });
    if (qty <= 0) return null;
    const critical = r.status === 'CRITICAL';
    return {
      ...base, action: 'ORDER', priority: critical ? 'HIGH' : 'MEDIUM', recommendedQuantity: qty,
      timing: critical ? 'ORDER TODAY' : 'ORDER SOON (reorder point reached)',
      reason: r.stock <= 0
        ? 'You are out of stock.'
        : `Current stock lasts about ${r.daysOfStock} days at ${r.avgDailySales} units a day, and your supplier needs ${r.leadTimeDays} days. ${critical ? 'You would run out before new stock arrives.' : 'Stock is at or below the reorder point.'}`,
      expectedImpact: 'Reduce stock-out risk and protect sales.',
    };
  }
  if (r.status === 'OVERSTOCK') {
    return {
      ...base, action: 'REDUCE_STOCK', priority: 'MEDIUM',
      reason: `${r.stock} units is about ${r.daysOfStock} days of sales (more than ${D.OVERSTOCK_DAYS}). Stop buying this product and consider a discount or bundle.`,
      capitalTiedUp: r.stockValue,
      expectedImpact: r.stockValue != null ? `Frees up to ${r.stockValue} tied in stock.` : 'Frees up cash tied in stock.',
    };
  }
  if (r.status === 'DEAD') {
    return {
      ...base, action: 'CLEAR_STOCK', priority: 'MEDIUM',
      reason: r.daysSinceLastSale == null
        ? `This product has not sold and ${r.stock} units are on hand.`
        : `No sale for ${r.daysSinceLastSale} days while ${r.stock} units sit on the shelf.`,
      capitalTiedUp: r.stockValue,
      expectedImpact: r.stockValue != null ? `Recovers up to ${r.stockValue} of tied-up capital.` : 'Recovers tied-up capital.',
    };
  }
  return null;
}

async function buildFacts(businessId) {
  const [business, products, stock, dem] = await Promise.all([
    Business.findById(businessId).lean(), productRepo.listAll(businessId),
    inventory.listStock(businessId), demand.getDemand(businessId),
  ]);

  const facts = {
    business: { name: business ? business.name : '', currency: business ? business.currency : 'KES' },
    hasProducts: products.length > 0, hasSales: dem.hasHistory,
    asOf: dem.asOf ? dem.asOf.toISOString().slice(0, 10) : null,
    windowDays: dem.windowDays, tradingDays: dem.tradingDays,
    totals: null, products: [], recommendations: [], limits: [],
  };
  if (!facts.hasProducts) { facts.limits.push('No products have been added or imported yet.'); return facts; }
  if (!dem.hasHistory) facts.limits.push('No sales have been recorded or imported yet, so demand and profit cannot be calculated.');

  let cur = [], prev = [];
  if (dem.hasHistory) {
    const a = dem.asOf;
    const endMs = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()) + DAY - 1;
    const from = endMs - dem.windowDays * DAY + 1;
    [cur, prev] = await Promise.all([
      salesByProduct(businessId, new Date(from), new Date(endMs)),
      salesByProduct(businessId, new Date(from - dem.windowDays * DAY), new Date(from - 1)),
    ]);
  }
  const curBy = new Map(cur.map((r) => [String(r._id), r]));
  const pBy = new Map(products.map((p) => [String(p._id), p]));

  facts.products = stock.map((s) => {
    const id = String(s.productId);
    const p = pBy.get(id) || {};
    const c = curBy.get(id);
    const d = dem.byProduct.get(id);
    const leadAssumed = p.supplierLeadTimeDays == null;
    const costed = c && c.costedRevenue > 0;
    return {
      productId: id, name: s.productName, sku: s.sku || null, category: p.category || null,
      stock: s.availableQuantity, incoming: s.incomingQuantity, avgDailySales: s.averageDailySales,
      daysOfStock: s.daysOfStock, reorderPoint: s.reorderPoint, status: s.reorderStatus,
      leadTimeDays: leadAssumed ? D.LEAD_TIME_DAYS : p.supplierLeadTimeDays, leadTimeAssumed: leadAssumed,
      safetyStock: p.safetyStock || 0, targetStock: p.targetStock ?? null,
      purchasePrice: p.purchasePrice ?? null, sellingPrice: p.sellingPrice ?? null, stockValue: s.stockValue,
      unitsSold: c ? c.units : 0, revenue: c ? r2(c.revenue) : 0,
      profit: costed ? r2(c.profit) : null, marginPct: costed ? r1((c.profit / c.costedRevenue) * 100) : null,
      daysSinceLastSale: d && d.lastSaleDate && dem.asOf ? demand.daysBetween(dem.asOf, d.lastSaleDate) : null,
    };
  });

  if (dem.hasHistory) {
    const t = sums(cur), pt = sums(prev);
    facts.totals = {
      periodDays: dem.windowDays, revenue: r2(t.revenue), unitsSold: t.units, soldItems: t.lines,
      profitOnCostedSales: t.costedRevenue > 0 ? r2(t.profit) : null,
      revenueGrowthPct: growth(t.revenue, pt.revenue), previousRevenue: r2(pt.revenue),
      profitGrowthPct: t.costedRevenue > 0 && pt.costedRevenue > 0 ? growth(t.profit, pt.profit) : null,
      costCoveragePct: t.revenue > 0 ? r1((t.costedRevenue / t.revenue) * 100) : null,
    };
    if (t.unknownCostLines) facts.limits.push(`${t.unknownCostLines} of ${t.lines} sold items have no purchase cost, so profit covers only ${facts.totals.costCoveragePct}% of revenue.`);
    if (facts.tradingDays < 14) facts.limits.push(`Only ${facts.tradingDays} trading day(s) of sales, so demand estimates have low confidence.`);
  }
  const assumed = facts.products.filter((p) => p.leadTimeAssumed).length;
  if (assumed) facts.limits.push(`${assumed} products have no supplier lead time, so ${D.LEAD_TIME_DAYS} days was assumed.`);

  facts.recommendations = facts.products.map((r) => recommend(r, facts)).filter(Boolean)
    .sort((a, b) => PRIORITY[a.priority] - PRIORITY[b.priority] || b.averageDailySales - a.averageDailySales);
  return facts;
}

const slim = (p) => p && ({
  name: p.name, sku: p.sku, category: p.category, stock: p.stock, incoming: p.incoming,
  avgDailySales: p.avgDailySales, daysOfStock: p.daysOfStock, reorderPoint: p.reorderPoint, status: p.status,
  leadTimeDays: p.leadTimeDays, leadTimeAssumed: p.leadTimeAssumed, safetyStock: p.safetyStock,
  purchasePrice: p.purchasePrice, sellingPrice: p.sellingPrice, stockValue: p.stockValue,
  unitsSold: p.unitsSold, revenue: p.revenue, profit: p.profit, marginPct: p.marginPct, daysSinceLastSale: p.daysSinceLastSale,
});

/** Picks only the facts relevant to the question, so Gemini never sees the whole database. */
function contextFor(intent, facts, product) {
  const common = { business: facts.business, dataAsOf: facts.asOf, windowDays: facts.windowDays, dataLimits: facts.limits };
  const recs = (...actions) => facts.recommendations.filter((r) => actions.includes(r.action));
  const costed = facts.products.filter((p) => p.profit != null);
  const counts = {
    needOrder: recs('ORDER').length, overstocked: recs('REDUCE_STOCK').length, deadStock: recs('CLEAR_STOCK').length,
  };

  if (product && ['PRODUCT', 'ORDER_QTY', 'WHEN_ORDER'].includes(intent)) {
    const rec = facts.recommendations.find((r) => r.productId === product.productId) || null;
    return {
      ...common, product: slim(product), recommendation: rec, recommendations: rec ? [rec] : [],
      noActionNote: rec ? null : `No action is needed right now: stock status is ${product.status}.`,
    };
  }
  switch (intent) {
    case 'ORDER_QTY':
    case 'WHEN_ORDER':
    case 'WHAT_TO_BUY':
      return { ...common, ordersNeeded: counts.needOrder, recommendations: recs('ORDER').slice(0, 8) };
    case 'STOP_BUYING':
      return { ...common, recommendations: recs('REDUCE_STOCK', 'CLEAR_STOCK').slice(0, 8) };
    case 'OVERSTOCK':
      return { ...common, recommendations: recs('REDUCE_STOCK').slice(0, 8) };
    case 'DEAD_STOCK':
      return { ...common, recommendations: recs('CLEAR_STOCK').slice(0, 8) };
    case 'PROFIT_WHY':
      return {
        ...common, totals: facts.totals,
        topProfit: [...costed].sort((a, b) => b.profit - a.profit).slice(0, 5).map(slim),
        lowMargin: costed.filter((p) => p.unitsSold > 0).sort((a, b) => a.marginPct - b.marginPct).slice(0, 5).map(slim),
      };
    case 'TOP_PROFIT':
      return {
        ...common, totals: facts.totals,
        topProfit: [...costed].sort((a, b) => b.profit - a.profit).slice(0, 8).map(slim),
        topMargin: costed.filter((p) => p.unitsSold > 0).sort((a, b) => b.marginPct - a.marginPct).slice(0, 5).map(slim),
      };
    case 'SALES':
      return { ...common, totals: facts.totals, topByRevenue: [...facts.products].sort((a, b) => b.revenue - a.revenue).slice(0, 8).map(slim) };
    case 'WHAT_TODAY':
      return { ...common, totals: facts.totals, counts, recommendations: facts.recommendations.slice(0, 5) };
    default:
      return { ...common, totals: facts.totals, counts, recommendations: facts.recommendations.slice(0, 3) };
  }
}

module.exports = { buildFacts, contextFor, slim };