const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const svc = require('../services/aiAssistant.service');
const ai = require('../services/ai.service');
const audit = require('../services/audit.service');

const ask = asyncHandler(async (req, res) => {
  const out = await svc.ask({ user: req.user, businessId: req.businessId, ...req.body });
  await audit.record(req, 'AI_ASKED', { entityType: 'AIConversation', entityId: out.conversationId, metadata: { intent: out.intent, source: out.source } });
  ok(res, out);
});
const explain = asyncHandler(async (req, res) => ok(res, await svc.explain({ businessId: req.businessId, input: req.body })));
const summarize = asyncHandler(async (req, res) => ok(res, await svc.summarize({ businessId: req.businessId })));
const businessPlan = asyncHandler(async (req, res) => {
  const out = await svc.businessPlan({ businessId: req.businessId, input: req.body });
  await audit.record(req, 'AI_BUSINESS_PLAN', { metadata: { source: out.source } });
  ok(res, out);
});
const conversations = asyncHandler(async (req, res) => ok(res, await svc.conversations({ user: req.user, businessId: req.businessId })));
const status = asyncHandler(async (_req, res) => ok(res, await ai.status()));


const welcome = asyncHandler(async (req, res) => ok(res, await svc.welcome({ user: req.user, businessId: req.businessId })));

module.exports = { ask, welcome, explain, summarize, businessPlan, conversations, status };
