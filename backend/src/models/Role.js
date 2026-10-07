const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  permissions: [String],
  system: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Role', schema);
