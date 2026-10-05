const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const svc = require('../services/decision.service');
const audit = require('../services/audit.service');

const preview = asyncHandler(async (req, res) => ok(res, { result: svc.preview(req.body) }));

const create = asyncHandler(async (req, res) => {
  const decision = await svc.create(req.user, req.businessId, req.body);
  await audit.record(req, 'DECISION_CREATED', { entityType: 'DecisionProblem', entityId: decision._id });
  created(res, { decision });
});

const list = asyncHandler(async (req, res) => ok(res, { decisions: await svc.list(req.businessId) }));
const get = asyncHandler(async (req, res) => ok(res, { decision: await svc.get(req.businessId, req.params.id) }));
const explain = asyncHandler(async (req, res) => ok(res, { explanation: await svc.explain(req.businessId, req.params.id) }));
const remove = asyncHandler(async (req, res) => {
  await svc.remove(req.businessId, req.params.id);
  await audit.record(req, 'DECISION_DELETED', { entityType: 'DecisionProblem', entityId: req.params.id });
  ok(res, { message: 'Deleted' });
});

module.exports = { preview, create, list, get, explain, remove };