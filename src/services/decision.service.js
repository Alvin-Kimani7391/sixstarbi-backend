const engine = require('./decision.engine');
const repo = require('../repositories/decision.repository');
const ai = require('./ai.service');
const ApiError = require('../utils/ApiError');

const preview = (input) => engine.analyze(input);

async function create(user, businessId, input) {
  const result = engine.analyze(input);
  const { title, ...inputs } = input;
  return repo.create({ businessId, userId: user._id, title, inputs, result });
}

const list = (businessId) => repo.list(businessId);

async function get(businessId, id) {
  const p = await repo.findById(businessId, id);
  if (!p) throw ApiError.notFound('Analysis not found');
  return p;
}

async function explain(businessId, id) {
  const problem = await get(businessId, id);
  const out = await ai.explainDecision(problem);
  problem.explanation = { text: out.text, source: out.source, generatedAt: new Date() };
  await problem.save();
  return problem.explanation;
}

async function remove(businessId, id) {
  const r = await repo.remove(businessId, id);
  if (!r.deletedCount) throw ApiError.notFound('Analysis not found');
}

module.exports = { preview, create, list, get, explain, remove };