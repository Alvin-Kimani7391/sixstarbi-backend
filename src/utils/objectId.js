const mongoose = require('mongoose');

// Aggregation pipelines do not auto-cast ids, so cast explicitly.
const oid = (v) => new mongoose.Types.ObjectId(String(v));

module.exports = { oid };