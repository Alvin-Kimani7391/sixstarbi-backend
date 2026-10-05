const mongoose = require('mongoose');
const ai = require('./ai.service');
const intentService = require('./intent.service');
const ctxService = require('./aiContext.service');
const decisionService = require('./decision.service');
const convRepo = require('../repositories/aiConversation.repository');
const ApiError = require('../utils/ApiError');

const ACTION_LABEL = { ORDER: 'Order', REDUCE_STOCK: 'Stop buying and reduce stock of', CLEAR_STOCK: 'Clear stock of' };
const pct = (c) => `${Math.round((c || 0) * 100)}%`;

/* ---------- built-in answers (used when Gemini is unavailable) ---------- */
const recLine = (r) =>
  `- ${ACTION_LABEL[r.action] || r.action}${r.recommendedQuantity ? ` ${r.recommendedQuantity} units of` : ''} ${r.productName}` +
  `${r.timing ? ` [${r.timing}]` : ''}: ${r.reason} (confidence ${pct(r.confidence)})`;

function fallbackAnswer(intent, ctx) {
  const out = ['The AI explainer is temporarily unavailable. Here is the direct answer from your data.', ''];
  if (ctx.product) {
    out.push(`${ctx.product.name}: ${ctx.product.stock} in stock, status ${ctx.product.status}.`);
    out.push(ctx.recommendation ? recLine(ctx.recommendation).slice(2) : ctx.noActionNote);
  } else if (ctx.recommendations && ctx.recommendations.length) {
    out.push(...ctx.recommendations.map(recLine));
  } else if (['ORDER_QTY', 'WHEN_ORDER', 'WHAT_TO_BUY', 'STOP_BUYING', 'OVERSTOCK', 'DEAD_STOCK', 'WHAT_TODAY'].includes(intent)) {
    out.push('Nothing needs action right now based on your current data.');
  }
  const t = ctx.totals;
  if (t) {
    out.push('', `Last ${t.periodDays} days: revenue ${t.revenue}${t.revenueGrowthPct != null ? ` (${t.revenueGrowthPct}% vs the period before)` : ''}, profit on costed sales ${t.profitOnCostedSales ?? 'not available'}.`);
  }
  const prod = (p) => `- ${p.name}: profit ${p.profit}, margin ${p.marginPct}%, ${p.unitsSold} units sold`;
  if (ctx.topProfit && ctx.topProfit.length) out.push('', 'Highest profit products:', ...ctx.topProfit.map(prod));
  if (ctx.lowMargin && ctx.lowMargin.length) out.push('', 'Lowest margin products:', ...ctx.lowMargin.map(prod));
  if (ctx.topByRevenue && ctx.topByRevenue.length) out.push('', 'Top products by revenue:', ...ctx.topByRevenue.map((p) => `- ${p.name}: revenue ${p.revenue}, ${p.unitsSold} units`));
  if (ctx.dataLimits && ctx.dataLimits.length) out.push('', 'Data limits:', ...ctx.dataLimits.map((l) => `- ${l}`));
  return out.join('\n');
}

const SYSTEM_ANSWERS = {
  NO_PRODUCTS: 'There is no product data yet. Open "Import data" and upload your products first (then purchases, sales and stock). After that I can tell you what to buy, how much and when.',
  TOOLS: 'Break-even, payoff-table and decision-tree problems are solved on their own pages: Decision analysis, Break-even and Decision tree. Enter your figures there and the system calculates and explains them.',
  SUPPLIER: 'Supplier comparison needs supplier data from Six Star Suppliers, which is a later phase. For now, enter the supplier name on each purchase so it is recorded for later.',
};

/* ---------- ask ---------- */
async function ask({ user, businessId, question, conversationId }) {
  let conv = null;
  if (conversationId) {
    conv = await convRepo.findOwn(businessId, user._id, conversationId);
    if (!conv) throw ApiError.notFound('Conversation not found');
  }
  const facts = await ctxService.buildFacts(businessId);
  const { intent, product } = intentService.detect(question, facts.products);

  let out;
  if (intent === 'TOOLS' || intent === 'SUPPLIER') {
    out = { text: SYSTEM_ANSWERS[intent], source: 'system', reason: null };
  } else if (!facts.hasProducts) {
    out = { text: SYSTEM_ANSWERS.NO_PRODUCTS, source: 'system', reason: null };
  } else {
    var ctx = ctxService.contextFor(intent, facts, product); // eslint-disable-line no-var
    const history = conv ? conv.messages.slice(-6).map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 600)}`) : [];
    const prompt = [
      history.length ? `Conversation so far:\n${history.join('\n')}` : '',
      `Question: ${question}`,
      'Calculated data (JSON, the only source of truth):',
      JSON.stringify(ctx),
      'Answer in under 250 words.',
    ].filter(Boolean).join('\n\n');
    out = await ai.run({ prompt, fallback: () => fallbackAnswer(intent, ctx) });
  }

  const now = new Date();
  const messages = [
    { role: 'user', content: question, createdAt: now },
    { role: 'assistant', content: out.text, source: out.source, createdAt: now },
  ];
  if (conv) {
    await convRepo.append(businessId, user._id, conv._id, messages);
  } else {
    conv = await convRepo.create({ businessId, userId: user._id, title: question.slice(0, 60), messages });
  }

  return {
    answer: out.text, source: out.source, reason: out.reason, conversationId: conv._id, intent,
    recommendations: (ctx && ctx.recommendations) || [],
  };
}

/* ---------- explain ---------- */
async function explain({ businessId, input }) {
  if (input.decisionId) {
    const problem = await decisionService.get(businessId, input.decisionId);
    const out = await ai.explainDecision(problem);
    return { explanation: out.text, source: out.source, reason: out.reason };
  }

  let productId = input.productId;
  let stored = null;
  if (input.recommendationId) {
    const Recommendation = mongoose.models.Recommendation; // exists once Batch 4 is added
    if (!Recommendation) throw ApiError.badRequest('Stored recommendations arrive with Batch 4. Explain by productId for now.', 'NOT_AVAILABLE');
    stored = await Recommendation.findOne({ _id: input.recommendationId, businessId }).lean();
    if (!stored) throw ApiError.notFound('Recommendation not found');
    productId = String(stored.productId);
  }

  const facts = await ctxService.buildFacts(businessId);
  const product = facts.products.find((p) => p.productId === String(productId));
  if (!product) throw ApiError.notFound('Product not found');
  const ctx = ctxService.contextFor('PRODUCT', facts, product);
  if (stored) { ctx.recommendation = stored; ctx.recommendations = [stored]; }

  const prompt = [
    'Explain to the business owner WHY the system gives this recommendation for this product (or why no action is needed).',
    'Structure: 1) the action, how much and when, 2) the evidence from the numbers (stock, daily sales, days of stock, lead time, safety stock, reorder point), 3) confidence and any assumptions, 4) one next step. Under 200 words.',
    '', JSON.stringify(ctx),
  ].join('\n');
  const out = await ai.run({ prompt, fallback: () => fallbackAnswer('PRODUCT', ctx) });
  return { explanation: out.text, source: out.source, reason: out.reason };
}

/* ---------- briefing ---------- */
async function summarize({ businessId }) {
  const facts = await ctxService.buildFacts(businessId);
  if (!facts.hasProducts) return { summary: SYSTEM_ANSWERS.NO_PRODUCTS, source: 'system', reason: null };
  const ctx = ctxService.contextFor('WHAT_TODAY', facts, null);
  const prompt = [
    'Write a short daily business briefing for the owner.',
    'Format: one line on sales and profit (only if present in the data), then "Priority actions" as a numbered list (action, product, quantity, when), then one line on data limits if any. Under 200 words.',
    '', JSON.stringify(ctx),
  ].join('\n');
  const out = await ai.run({ prompt, fallback: () => fallbackAnswer('WHAT_TODAY', ctx) });
  return { summary: out.text, source: out.source, reason: out.reason };
}

/* ---------- business plan ---------- */
// Default split of starting capital. These are stated assumptions, not predictions.
const SPLIT = [
  ['Starting inventory', 55], ['Setup and equipment', 10], ['Marketing', 10],
  ['Operating costs (first 2 months)', 10], ['Cash reserve', 15],
];

function allocate(capital) {
  let left = capital;
  return SPLIT.map(([item, percent], i) => {
    const amount = i === SPLIT.length - 1 ? left : Math.round((capital * percent) / 100);
    left -= amount;
    return { item, percent, amount };
  });
}

async function businessPlan({ businessId, input }) {
  const allocation = allocate(input.capital);
  const data = {
    concept: input.concept, capital: input.capital, location: input.location || 'not given', mode: input.mode,
    experience: input.experience, riskTolerance: input.risk, notes: input.notes || null, allocation,
    assumption: 'Capital split uses default percentages (inventory 55, setup 10, marketing 10, operating 10, reserve 15). The owner can change them.',
  };
  const prompt = [
    'Write a practical starter business plan for this owner using ONLY the data below.',
    'Sections: Business concept, Target market, What to sell first (types of products, no invented prices), Capital allocation (use the allocation exactly), Main risks, 30-day plan, 60-day plan, 90-day plan.',
    'Do not invent prices, sales forecasts, profit figures or market sizes. Where a number is needed, tell the owner what to research or measure. Under 550 words.',
    '', JSON.stringify(data),
  ].join('\n');

  const fallback = () => [
    'The AI writer is temporarily unavailable. Here is the structured part of your plan.', '',
    `Concept: ${input.concept}`, `Starting capital: ${input.capital}`, '', 'Capital allocation:',
    ...allocation.map((a) => `- ${a.item}: ${a.amount} (${a.percent}%)`), '',
    '30 days: confirm suppliers and prices, buy starting stock, set up your sales channel.',
    '60 days: record every sale and purchase, review what sells, reorder only fast movers.',
    '90 days: compare actual profit to your costs, adjust prices, decide whether to grow.',
  ].join('\n');

  const out = await ai.run({ prompt, fallback });
  return { plan: out.text, allocation, source: out.source, reason: out.reason };
}

async function conversations({ user, businessId }) {
  return { conversations: await convRepo.listOwn(businessId, user._id) };
}

module.exports = { ask, explain, summarize, businessPlan, conversations, fallbackAnswer };