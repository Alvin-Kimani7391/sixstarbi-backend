const gemini = require('../integrations/gemini/gemini.client');
const logger = require('../config/logger');

const money = (n) => `${Math.round(n).toLocaleString('en-KE')}`;

function buildContext(problem) {
  const { inputs, result } = problem;
  return {
    title: problem.title,
    inputs: {
      unitCost: inputs.unitCost, sellingPrice: inputs.sellingPrice,
      salvageValue: inputs.salvageValue, shortageCost: inputs.shortageCost,
      hurwiczAlpha: inputs.hurwiczAlpha,
    },
    demandLevels: result.demands,
    orderOptions: result.options,
    payoffTable: result.payoff,
    regretTable: result.regret,
    probabilities: result.probabilities,
    criteria: result.criteria.map((c) => ({ method: c.label, bestOrders: c.bestOrders, value: c.value })),
    recommendation: result.recommendation,
    votes: result.votes,
    evpi: result.evpi,
    warnings: result.warnings,
  };
}

function fallbackExplanation(problem) {
  const { result } = problem;
  const r = result.recommendation;
  const lines = [
    `The AI explainer is temporarily unavailable. Here is the direct answer.`,
    ``,
    `RECOMMENDATION: Order ${r.order} units (basis: ${r.basis}).`,
    r.note,
    ``,
    `What each method says:`,
    ...result.criteria.map((c) => `- ${c.label}: order ${c.bestOrders.join(' or ')} (value ${money(c.value)})`),
  ];
  if (result.evpi != null) lines.push('', `The most you should pay for perfect information about demand is ${money(result.evpi)} (EVPI).`);
  if (result.warnings.length) lines.push('', 'Please note:', ...result.warnings.map((w) => `- ${w}`));
  return lines.join('\n');
}

async function explainDecision(problem) {
  const prompt = [
    'You are the explainer inside Six Star Intelligence, a business decision tool.',
    'Below is a JSON result that the system has ALREADY calculated. Explain it to a business owner in plain English.',
    'Rules: never recalculate or change any number; only use numbers present in the JSON; do not invent data.',
    'Structure: 1) the direct recommendation, 2) why, referencing the payoff and regret tables, 3) how the different methods compare and when each suits a decision maker, 4) risks and any warnings, 5) one practical next step.',
    'Keep it under 350 words. Use currency as plain numbers.',
    '',
    JSON.stringify(buildContext(problem)),
  ].join('\n');

  try {
    return { text: await gemini.generate(prompt), source: 'gemini' };
  } catch (err) {
    logger.warn(`Gemini explain failed: ${err.message}`);
    return { text: fallbackExplanation(problem), source: 'fallback' };
  }
}

module.exports = { explainDecision, fallbackExplanation };