const mongoose = require('mongoose');

module.exports = mongoose.model(
  'Counter',
  new mongoose.Schema({ _id: { type: String }, seq: { type: Number, default: 0 } })
);