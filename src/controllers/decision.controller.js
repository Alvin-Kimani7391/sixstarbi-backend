const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const svc = require('../services/decision.service');
const audit = require('../services/audit.service');

const preview = asyncHandler(async (req, res) => ok(res, { result: svc.preview(req.body) }));

const createKind = (kind) =>
  asyncHandler(async (req, res) => {
    const decision = await svc.create(req.user, req.businessId, req.body, kind);
    await audit.record(req, 'DECISION_CREATED', { entityType: 'DecisionProblem', entityId: decision._id, metadata: { kind } });
    created(res, { decision });
  });

const list = asyncHandler(async (req, res) =>
  ok(res, { decisions: await svc.list(req.businessId, req.query.kind) })
);
const get = asyncHandler(async (req, res) => ok(res, { decision: await svc.get(req.businessId, req.params.id) }));
const explain = asyncHandler(async (req, res) => ok(res, { explanation: await svc.explain(req.businessId, req.params.id) }));
const remove = asyncHandler(async (req, res) => {
  await svc.remove(req.businessId, req.params.id);
  await audit.record(req, 'DECISION_DELETED', { entityType: 'DecisionProblem', entityId: req.params.id });
  ok(res, { message: 'Deleted' });
});

module.exports = {
  preview, list, get, explain, remove,
  create: createKind('PAYOFF'),
  createBreakEven: createKind('BREAKEVEN'),
  createTree: createKind('TREE'),
};