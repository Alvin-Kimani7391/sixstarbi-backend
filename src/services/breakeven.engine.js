const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function analyze({ fixedCost, sellingPrice, variableCost, expectedUnits, targetProfit }) {
  const cm = sellingPrice - variableCost; // contribution margin per unit
  const warnings = [];
  const base = {
    contributionMargin: round(cm),
    contributionMarginRatio: sellingPrice > 0 ? round((cm / sellingPrice) * 100) : 0,
    warnings,
  };

  if (cm <= 0) {
    warnings.push('Selling price must be higher than the variable cost per unit. At these figures you can never break even.');
    return {
      ...base, breakEvenUnits: null, breakEvenUnitsWhole: null, breakEvenRevenue: null,
      targetUnits: null, expectedUnits: expectedUnits ?? null,
      profitAtExpected: expectedUnits != null ? round(cm * expectedUnits - fixedCost) : null,
      marginOfSafetyUnits: null, marginOfSafetyPct: null, chart: [], headline: 'No break-even point',
    };
  }

  const be = fixedCost / cm;
  const out = {
    ...base,
    breakEvenUnits: round(be),
    breakEvenUnitsWhole: Math.ceil(be - 1e-9),
    breakEvenRevenue: round(be * sellingPrice),
    targetUnits: targetProfit != null ? Math.ceil((fixedCost + targetProfit) / cm - 1e-9) : null,
    expectedUnits: expectedUnits ?? null,
    profitAtExpected: null, marginOfSafetyUnits: null, marginOfSafetyPct: null,
  };

  if (expectedUnits != null) {
    out.profitAtExpected = round(cm * expectedUnits - fixedCost);
    if (expectedUnits > 0) {
      out.marginOfSafetyUnits = round(expectedUnits - be);
      out.marginOfSafetyPct = round(((expectedUnits - be) / expectedUnits) * 100);
    }
    if (expectedUnits < be) warnings.push('At your expected sales you would make a loss.');
  }

  const top = Math.max(be * 2, (expectedUnits || 0) * 1.2, 10);
  out.chart = Array.from({ length: 11 }, (_, i) => {
    const units = round((top / 10) * i);
    return { units, revenue: round(units * sellingPrice), totalCost: round(fixedCost + units * variableCost) };
  });
  out.headline = `Break even at ${out.breakEvenUnitsWhole.toLocaleString('en-KE')} units`;
  return out;
}

module.exports = { analyze };