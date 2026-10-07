const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;
const schema = new mongoose.Schema({
  employerId: { type: ObjectId, ref: 'Employer', required: true, index: true },
  userId: { type: ObjectId, ref: 'User' },
  planId: { type: ObjectId, ref: 'Plan' },
  purpose: { type: String, enum: ['subscription', 'credits'], required: true },
  couponCode: String,
  baseAmount: Number,
  discount: { type: Number, default: 0 },
  gstAmount: Number,
  totalAmount: Number,
  currency: { type: String, default: 'INR' },
  orderId: { type: String, index: true },
  paymentRef: String,
  status: { type: String, enum: ['created', 'paid', 'failed', 'refunded'], default: 'created' },
  provider: { type: String, default: 'razorpay' },
  mock: Boolean,
  invoiceNumber: String,
  paidAt: Date,
  refundedAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('Payment', schema);
