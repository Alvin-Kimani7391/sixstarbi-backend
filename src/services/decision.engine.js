const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const profit = (q, d, { unitCost, sellingPrice, salvageValue, shortageCost }) =>
  sellingPrice * Math.min(q, d) +
  salvageValue * Math.max(q - d, 0) -
  unitCost * q -
  shortageCost * Math.max(d - q, 0);

function warnings(i) {
  const w = [];
  if (i.sellingPrice <= i.unitCost) w.push('Selling price is not above cost, so every sale loses money.');
  if (i.salvageValue > i.unitCost) w.push('Salvage value is higher than cost, so leftover stock is never a loss. The best choice will be to order the most.');
  if (i.salvageValue > i.sellingPrice) w.push('Salvage value is higher than the normal selling price. Please check the figures.');
  return w;
}

function analyze(input) {
  const { unitCost, sellingPrice } = input;
  const salvageValue = input.salvageValue ?? 0;
  const shortageCost = input.shortageCost ?? 0;
  const alpha = input.hurwiczAlpha ?? 0.5;
  const p = { unitCost, sellingPrice, salvageValue, shortageCost };

  const scenarios = [...input.scenarios].sort((a, b) => a.demand - b.demand);
  const demands = scenarios.map((s) => s.demand);
  const options = [...new Set(input.orderOptions?.length ? input.orderOptions : demands)].sort((a, b) => a - b);

  const payoff = options.map((q) => demands.map((d) => round(profit(q, d, p))));
  const colBest = demands.map((_, j) => Math.max(...payoff.map((r) => r[j])));
  const regret = payoff.map((r) => r.map((v, j) => round(colBest[j] - v)));

  const hasProbs = scenarios.every((s) => typeof s.probability === 'number');
  const probs = hasProbs ? scenarios.map((s) => s.probability) : null;
  const dot = (row) => row.reduce((a, v, j) => a + v * probs[j], 0);

  const rows = options.map((q, i) => {
    const min = Math.min(...payoff[i]);
    const max = Math.max(...payoff[i]);
    return {
      order: q, min, max,
      maxRegret: Math.max(...regret[i]),
      laplace: round(payoff[i].reduce((a, b) => a + b, 0) / demands.length),
      hurwicz: round(alpha * max + (1 - alpha) * min),
      emv: hasProbs ? round(dot(payoff[i])) : null,
      eol: hasProbs ? round(dot(regret[i])) : null,
    };
  });

  const pick = (key, dir, label, rule) => {
    const vals = rows.map((r) => r[key]);
    const target = dir === 'max' ? Math.max(...vals) : Math.min(...vals);
    return { key, label, rule, value: target, bestOrders: rows.filter((r) => r[key] === target).map((r) => r.order) };
  };

  const criteria = [
    pick('max', 'max', 'Maximax (optimistic)', 'Choose the order with the highest possible profit.'),
    pick('min', 'max', 'Maximin (pessimistic)', 'Choose the order whose worst outcome is best.'),
    pick('maxRegret', 'min', 'Minimax regret', 'Choose the order whose biggest regret is smallest.'),
    pick('laplace', 'max', 'Laplace (equal likelihood)', 'Treat all demand levels as equally likely and choose the best average profit.'),
    pick('hurwicz', 'max', `Hurwicz (alpha = ${alpha})`, 'Blend of best and worst outcome using the optimism coefficient.'),
  ];
  if (hasProbs) {
    criteria.push(pick('emv', 'max', 'Expected monetary value', 'Choose the order with the highest probability-weighted profit.'));
    criteria.push(pick('eol', 'min', 'Expected opportunity loss', 'Choose the order with the lowest probability-weighted regret.'));
  }

  const primary = criteria.find((c) => c.key === (hasProbs ? 'emv' : 'laplace'));
  const votes = {};
  criteria.filter((c) => c.key !== 'eol').forEach((c) => c.bestOrders.forEach((o) => { votes[o] = (votes[o] || 0) + 1; }));

  return {
    demands, options, payoff, regret, rows, criteria,
    probabilities: probs,
    recommendation: {
      basis: primary.label,
      order: primary.bestOrders[0],
      tiedOrders: primary.bestOrders,
      expectedValue: primary.value,
      note: hasProbs
        ? 'Based on the probabilities you provided.'
        : 'No probabilities were given, so equal likelihood (Laplace) is used as the main basis.',
    },
    votes,
    evpi: hasProbs ? round(Math.min(...rows.map((r) => r.eol))) : null,
    warnings: warnings({ unitCost, sellingPrice, salvageValue }),
  };
}

module.exports = { analyze, profit };