const ApiError = require('../utils/ApiError');

const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const MAX_DEPTH = 8;

function evaluate(node, depth = 0) {
  if (depth > MAX_DEPTH) throw ApiError.unprocessable(`Tree is too deep (maximum ${MAX_DEPTH} levels)`, 'TREE_TOO_DEEP');
  if (node.type === 'end') return { type: 'end', label: node.label || 'Outcome', value: node.payoff ?? 0 };

  if (!node.branches || !node.branches.length) {
    throw ApiError.unprocessable(`"${node.label || node.type}" needs at least one branch`, 'TREE_INVALID');
  }
  const branches = node.branches.map((b) => {
    const child = evaluate(b.node, depth + 1);
    const cost = b.cost || 0;
    return { label: b.label, probability: b.probability, cost, net: round(child.value - cost), node: child };
  });

  if (node.type === 'chance') {
    if (branches.some((b) => typeof b.probability !== 'number')) {
      throw ApiError.unprocessable(`Every outcome at "${node.label}" needs a probability`, 'TREE_INVALID');
    }
    const sum = branches.reduce((a, b) => a + b.probability, 0);
    if (Math.abs(sum - 1) > 0.001) {
      throw ApiError.unprocessable(`Probabilities at "${node.label}" must add up to 100%`, 'TREE_INVALID');
    }
    return { type: 'chance', label: node.label, value: round(branches.reduce((a, b) => a + b.probability * b.net, 0)), branches };
  }

  const best = Math.max(...branches.map((b) => b.net));
  branches.forEach((b) => { b.chosen = b.net === best; });
  return { type: 'decision', label: node.label, value: best, branches };
}

// Lowest and highest net outcome across every possible path below a node.
const range = (n) =>
  n.type === 'end'
    ? [n.value, n.value]
    : n.branches.reduce(
        ([lo, hi], b) => {
          const [l, h] = range(b.node);
          return [Math.min(lo, l - b.cost), Math.max(hi, h - b.cost)];
        },
        [Infinity, -Infinity]
      );

function analyze({ root }) {
  const tree = evaluate(root);
  const warnings = [];
  let alternatives = [];
  let recommendation = null;
  let headline = `Expected value ${Math.round(tree.value).toLocaleString('en-KE')}`;

  if (tree.type === 'decision') {
    alternatives = tree.branches.map((b) => {
      const [worst, best] = range(b.node);
      return { label: b.label, expectedValue: b.net, worstCase: round(worst - b.cost), bestCase: round(best - b.cost), chosen: Boolean(b.chosen) };
    });
    const chosen = alternatives.filter((a) => a.chosen).map((a) => a.label);
    recommendation = { choice: chosen[0], tied: chosen, expectedValue: tree.value };
    headline = `Choose "${chosen[0]}" (expected value ${Math.round(tree.value).toLocaleString('en-KE')})`;
    if (chosen.length > 1) warnings.push(`${chosen.length} alternatives tie on expected value. Consider risk (worst case) to choose between them.`);
    if (tree.value < 0) warnings.push('Even the best alternative has a negative expected value.');
  }

  return { tree, expectedValue: tree.value, alternatives, recommendation, warnings, headline };
}

module.exports = { analyze };