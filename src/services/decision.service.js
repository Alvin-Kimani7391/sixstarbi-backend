const payoff = require('./decision.engine');
const breakEven = require('./breakeven.engine');
const tree = require('./tree.engine');
const repo = require('../repositories/decision.repository');
const ai = require('./ai.service');
const ApiError = require('../utils/ApiError');

const analyzers = {
  PAYOFF: (input) => {
    const r = payoff.analyze(input);
    r.headline = `Order ${r.recommendation.order} units`;
    return r;
  },
  BREAKEVEN: breakEven.analyze,
  TREE: tree.analyze,
};

const preview = (input, kind = 'PAYOFF') => analyzers[kind](input);

async function create(user, businessId, input, kind = 'PAYOFF') {
  const result = analyzers[kind](input);
  const { title, ...inputs } = input;
  return repo.create({ businessId, userId: user._id, kind, title, inputs, result });
}

const list = (businessId, kind) => repo.list(businessId, kind);

async function get(businessId, id) {
  const p = await repo.findById(businessId, id);
  if (!p) throw ApiError.notFound('Analysis not found');
  return p;
}

async function explain(businessId, id) {
  const problem = await get(businessId, id);
  const out = await ai.explainDecision(problem);
  const explanation = { text: out.text, source: out.source, generatedAt: new Date() };
  problem.explanation = explanation;
  await problem.save();
  return { ...explanation, reason: out.reason };
}

async function remove(businessId, id) {
  const r = await repo.remove(businessId, id);
  if (!r.deletedCount) throw ApiError.notFound('Analysis not found');
}

module.exports = { preview, create, list, get, explain, remove };