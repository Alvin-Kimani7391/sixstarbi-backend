const { z } = require('zod');

const num = z.coerce.number().finite();

const problem = z
  .object({
    title: z.string().trim().min(2).max(160),
    unitCost: num.min(0),
    sellingPrice: num.min(0),
    salvageValue: num.min(0).default(0),
    shortageCost: num.min(0).default(0),
    hurwiczAlpha: num.min(0).max(1).default(0.5),
    scenarios: z
      .array(z.object({ demand: num.min(0), probability: num.min(0).max(1).optional() }))
      .min(2, 'Enter at least two demand levels')
      .max(20),
    orderOptions: z.array(num.min(0)).max(20).optional(),
  })
  .superRefine((v, ctx) => {
    const demands = v.scenarios.map((s) => s.demand);
    if (new Set(demands).size !== demands.length) {
      ctx.addIssue({ code: 'custom', path: ['scenarios'], message: 'Demand levels must be unique' });
    }
    const withProb = v.scenarios.filter((s) => s.probability !== undefined).length;
    if (withProb !== 0 && withProb !== v.scenarios.length) {
      ctx.addIssue({ code: 'custom', path: ['scenarios'], message: 'Give a probability for every demand level, or for none' });
    } else if (withProb > 0) {
      const sum = v.scenarios.reduce((a, s) => a + s.probability, 0);
      if (Math.abs(sum - 1) > 0.001) {
        ctx.addIssue({ code: 'custom', path: ['scenarios'], message: 'Probabilities must add up to 100%' });
      }
    }
  });

const idParam = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id') });


const breakEven = z.object({
  title: z.string().trim().min(2).max(160),
  fixedCost: num.min(0),
  sellingPrice: num.min(0),
  variableCost: num.min(0),
  expectedUnits: num.min(0).optional(),
  targetProfit: num.optional(),
});

const node = z.lazy(() =>
  z.object({
    type: z.enum(['decision', 'chance', 'end']),
    label: z.string().trim().max(120).default(''),
    payoff: num.optional(),
    branches: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(120),
          probability: num.min(0).max(1).optional(),
          cost: num.optional(),
          node,
        })
      )
      .max(12)
      .optional(),
  })
);

const tree = z.object({ title: z.string().trim().min(2).max(160), root: node });


module.exports = { problem, idParam, breakEven, tree };