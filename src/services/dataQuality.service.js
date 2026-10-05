const { INVENTORY_DEFAULTS: D } = require('../constants');

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const pct = (a, b) => Math.round((a / b) * 100);

// Share (0 to 1) of imported records that are missing information the intelligence needs.
function completeness(type, stats) {
  if (type === 'products') {
    const n = stats.imported || 0;
    return n ? (stats.missingPurchasePrice + stats.missingSellingPrice) / (2 * n) : 0;
  }
  if (type === 'sales') return stats.lines ? stats.missingCostLines / stats.lines : 0;
  return 0;
}

/**
 * Clean rows score 1, corrected rows 0.9, duplicates 0.5, rejected rows 0.
 * Then up to 15 points are removed for missing prices or costs.
 */
function score(totals, completenessShare) {
  if (!totals.processed) return 0;
  const base = ((totals.valid + 0.9 * totals.corrected + 0.5 * totals.duplicates) / totals.processed) * 100;
  return clamp(base - 15 * completenessShare);
}

function notes({ type, totals, stats }) {
  const out = [];
  const { processed, incomplete, duplicates } = totals;

  if (processed && incomplete) {
    out.push(`${incomplete} of ${processed} rows (${pct(incomplete, processed)}%) could not be imported. Fix those rows and import only them, not the whole file again.`);
  }
  if (duplicates) out.push(`${duplicates} duplicate rows were skipped.`);
  if (stats.ambiguousDates) {
    out.push(`${stats.ambiguousDates} dates such as 03/04/2025 could be read two ways. They were read day first (3 April). Check that this matches your file.`);
  }
  if (stats.unknownProducts) {
    out.push(`${stats.unknownProducts} rows named products that are not in your catalog. Import your products file first for complete analytics.`);
  }

  if (type === 'products' && stats.imported) {
    const n = stats.imported;
    if (stats.missingPurchasePrice) out.push(`Profit and capital-tied-up figures have lower confidence because ${stats.missingPurchasePrice} of ${n} products have no purchase price.`);
    if (stats.missingSellingPrice) out.push(`${stats.missingSellingPrice} of ${n} products have no selling price, so their margins cannot be shown.`);
    if (stats.missingLeadTime) out.push(`${stats.missingLeadTime} of ${n} products have no supplier lead time. Reorder calculations assume ${D.LEAD_TIME_DAYS} days until you set one.`);
  }

  if (type === 'sales' && stats.lines) {
    if (stats.missingCostLines) {
      const share = stats.missingCostLines / stats.lines;
      const level = share >= 0.4 ? 'low' : 'medium';
      out.push(`Profit recommendations have ${level} confidence because purchase costs are missing for ${stats.missingCostLines} of ${stats.lines} sold items (${pct(stats.missingCostLines, stats.lines)}%). Import products with purchase prices before importing sales.`);
    }
    if (stats.historyDays < 14) out.push(`Only ${stats.historyDays} day(s) of sales history. Demand and reorder estimates have low confidence until you have about 30 days.`);
    else if (stats.historyDays < 30) out.push(`${stats.historyDays} days of sales history. Demand estimates have medium confidence. About 30 days or more gives reliable results.`);
  }

  if (type === 'purchases' && stats.backfilledCosts) {
    out.push(`Purchase prices for ${stats.backfilledCosts} products were empty, so they were filled from the latest cost in this file. Profit can now be calculated for them.`);
  }
  if (type === 'inventory' && stats.counted) {
    out.push(`Stock was updated for ${stats.adjusted} products. Each change is recorded in the stock audit trail.`);
  }

  if (!out.length) out.push('No data problems were found that affect your recommendations.');
  return out;
}

module.exports = { completeness, score, notes };