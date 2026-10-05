const { z } = require('zod');

const oid = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const ask = z.object({ question: z.string().trim().min(2).max(500), conversationId: oid.nullish() });

const explain = z.object({
  recommendationId: oid.optional(), productId: oid.optional(), decisionId: oid.optional(),
}).refine((v) => v.recommendationId || v.productId || v.decisionId, 'Provide a recommendationId, productId or decisionId');

const summarize = z.object({}).passthrough();

const businessPlan = z.object({
  concept: z.string().trim().min(3).max(200),
  capital: z.coerce.number().positive().max(1e12),
  location: z.string().trim().max(120).optional(),
  mode: z.enum(['physical', 'online', 'both']).default('physical'),
  experience: z.enum(['none', 'some', 'experienced']).default('some'),
  risk: z.enum(['low', 'medium', 'high']).default('medium'),
  notes: z.string().trim().max(500).optional(),
});

module.exports = { ask, explain, summarize, businessPlan };