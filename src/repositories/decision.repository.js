const DecisionProblem = require('../models/DecisionProblem');

const KINDS = ['PAYOFF', 'BREAKEVEN', 'TREE'];

// Every query takes businessId. This is the tenant boundary.
module.exports = {
  create: (data) => DecisionProblem.create(data),
  list: (businessId, kind) => {
    const filter = { businessId };
    if (KINDS.includes(kind)) {
      // Analyses saved before `kind` existed are payoff problems.
      filter.$or = kind === 'PAYOFF' ? [{ kind }, { kind: { $exists: false } }] : [{ kind }];
    }
    return DecisionProblem.find(filter)
      .select('title kind result.headline result.recommendation createdAt')
      .sort({ createdAt: -1 })
      .limit(50);
  },
  findById: (businessId, id) => DecisionProblem.findOne({ _id: id, businessId }),
  remove: (businessId, id) => DecisionProblem.deleteOne({ _id: id, businessId }),
};