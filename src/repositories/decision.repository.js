const DecisionProblem = require('../models/DecisionProblem');

// Every query takes businessId. This is the tenant boundary.
module.exports = {
  create: (data) => DecisionProblem.create(data),
  list: (businessId) =>
    DecisionProblem.find({ businessId }).select('title inputs.sellingPrice result.recommendation createdAt').sort({ createdAt: -1 }).limit(50),
  findById: (businessId, id) => DecisionProblem.findOne({ _id: id, businessId }),
  remove: (businessId, id) => DecisionProblem.deleteOne({ _id: id, businessId }),
};