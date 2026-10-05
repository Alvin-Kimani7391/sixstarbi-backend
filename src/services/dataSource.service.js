const DataSource = require('../models/DataSource');

// One DataSource per business and type. Imports and integrations attach to it.
async function getOrCreate(businessId, type, name) {
  return DataSource.findOneAndUpdate(
    { businessId, type },
    { $setOnInsert: { businessId, type, name: name || type } },
    { new: true, upsert: true }
  );
}

const touch = (id) => DataSource.updateOne({ _id: id }, { $set: { lastSyncAt: new Date() } });



module.exports = { getOrCreate, touch };