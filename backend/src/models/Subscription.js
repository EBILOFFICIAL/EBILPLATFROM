const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;
const schema = new mongoose.Schema({
  employerId: { type: ObjectId, ref: 'Employer', required: true, index: true },
  planId: { type: ObjectId, ref: 'Plan', required: true },
  status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' },
  startsAt: Date,
  endsAt: Date,
  paymentId: { type: ObjectId, ref: 'Payment' },
}, { timestamps: true });

module.exports = mongoose.model('Subscription', schema);
