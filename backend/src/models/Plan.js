const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  type: { type: String, enum: ['subscription', 'credit_pack'], default: 'subscription' },
  priceInr: { type: Number, default: 0 },
  billingCycle: { type: String, enum: ['monthly', 'yearly', 'one_time'], default: 'monthly' },
  credits: { type: Number, default: 0 },
  seats: { type: Number, default: 1 },
  jobPosts: { type: Number, default: 1 },
  apiCalls: { type: Number, default: 0 },
  features: [String],
  highlighted: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Plan', schema);
