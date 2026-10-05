const Asset = require('../models/Asset');

module.exports = {
  create: (data) => Asset.create(data),
  findById: (businessId, id) => Asset.findOne({ _id: id, businessId }),
  remove: (businessId, id) => Asset.deleteOne({ _id: id, businessId }),
};