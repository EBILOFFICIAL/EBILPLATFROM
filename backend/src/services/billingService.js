const crypto = require('crypto');
const Plan = require('../models/Plan');
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const Employer = require('../models/Employer');
const { Coupon, CreditTransaction } = require('../models/misc');
const AppError = require('../utils/AppError');
const rzp = require('../config/razorpay');
const settings = require('./settingsService');

const sign = (orderId, paymentId) => crypto.createHmac('sha256', rzp.keySecret || 'mock-secret').update(`${orderId}|${paymentId}`).digest('hex');

async function priceFor(plan, couponCode) {
  let discount = 0;
  let coupon = null;
  if (couponCode) {
    coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), active: true });
    if (!coupon || coupon.used >= coupon.maxUses || (coupon.validUntil && coupon.validUntil < new Date())) throw AppError.badRequest('Invalid or expired coupon');
    discount = Math.min(plan.priceInr, Math.round(plan.priceInr * (coupon.percentOff / 100) + coupon.flatOff));
  }
  const base = plan.priceInr - discount;
  const gst = Math.round(base * ((await settings.get('gstPercent')) / 100));
  return { baseAmount: plan.priceInr, discount, gstAmount: gst, totalAmount: base + gst, coupon };
}

async function createOrder(employer, user, { planId, couponCode }, purpose) {
  const plan = await Plan.findOne({ _id: planId, active: true });
  if (!plan) throw AppError.notFound('Plan not found');
  const price = await priceFor(plan, couponCode);
  const receipt = `eibil_${Date.now()}`;
  const order = rzp.isMock || price.totalAmount === 0
    ? { id: `order_mock_${crypto.randomBytes(6).toString('hex')}` }
    : await rzp.client.orders.create({ amount: price.totalAmount * 100, currency: 'INR', receipt });
  const payment = await Payment.create({ employerId: employer._id, userId: user._id, planId, purpose, couponCode: price.coupon?.code, baseAmount: price.baseAmount, discount: price.discount, gstAmount: price.gstAmount, totalAmount: price.totalAmount, orderId: order.id, mock: rzp.isMock });
  return { paymentId: payment._id, orderId: order.id, amount: price.totalAmount * 100, currency: 'INR', keyId: rzp.keyId, mock: rzp.isMock || price.totalAmount === 0, ...price, coupon: undefined, mockSignature: rzp.isMock ? undefined : undefined };
}

async function fulfil(payment, paymentRef) {
  if (payment.status === 'paid') return payment;
  const plan = await Plan.findById(payment.planId);
  const employer = await Employer.findById(payment.employerId);
  payment.status = 'paid';
  payment.paymentRef = paymentRef;
  payment.paidAt = new Date();
  payment.invoiceNumber = `EIB/INV/${new Date().getFullYear()}/${String(await Payment.countDocuments({ status: 'paid' }) + 1).padStart(5, '0')}`;
  await payment.save();
  if (payment.couponCode) await Coupon.updateOne({ code: payment.couponCode }, { $inc: { used: 1 } });
  if (plan.type === 'subscription') {
    const endsAt = new Date(Date.now() + (plan.billingCycle === 'yearly' ? 365 : 30) * 864e5);
    await Subscription.updateMany({ employerId: employer._id, status: 'active' }, { status: 'expired' });
    await Subscription.create({ employerId: employer._id, planId: plan._id, startsAt: new Date(), endsAt, paymentId: payment._id });
    employer.planId = plan._id;
    employer.planExpiresAt = endsAt;
  }
  employer.creditBalance += plan.credits;
  await employer.save();
  await CreditTransaction.create({ employerId: employer._id, amount: plan.credits, balanceAfter: employer.creditBalance, reason: `${plan.name} purchase`, refId: payment.invoiceNumber });
  return payment;
}

async function verifyPayment(employer, { orderId, razorpayPaymentId, razorpaySignature }) {
  const payment = await Payment.findOne({ orderId, employerId: employer._id });
  if (!payment) throw AppError.notFound('Order not found');
  if (payment.mock) return fulfil(payment, `pay_mock_${Date.now()}`);
  if (sign(orderId, razorpayPaymentId) !== razorpaySignature) {
    payment.status = 'failed';
    await payment.save();
    throw AppError.badRequest('Payment signature verification failed');
  }
  return fulfil(payment, razorpayPaymentId);
}

async function webhook(rawBody, signature) {
  const expected = crypto.createHmac('sha256', rzp.webhookSecret || 'mock-webhook').update(rawBody).digest('hex');
  if (expected !== signature) throw AppError.badRequest('Invalid webhook signature');
  const event = JSON.parse(rawBody.toString());
  const entity = event.payload?.payment?.entity;
  if (event.event === 'payment.captured' && entity?.order_id) {
    const payment = await Payment.findOne({ orderId: entity.order_id });
    if (payment) await fulfil(payment, entity.id);
  }
  return { received: true };
}

async function refund(paymentId) {
  const payment = await Payment.findById(paymentId);
  if (!payment || payment.status !== 'paid') throw AppError.badRequest('Only paid payments can be refunded');
  if (!payment.mock && rzp.client) await rzp.client.payments.refund(payment.paymentRef, { amount: payment.totalAmount * 100 });
  payment.status = 'refunded';
  payment.refundedAt = new Date();
  return payment.save();
}

async function adjustCredits(employerId, amount, reason, by) {
  const employer = await Employer.findByIdAndUpdate(employerId, { $inc: { creditBalance: amount } }, { new: true });
  await CreditTransaction.create({ employerId, amount, balanceAfter: employer.creditBalance, reason, by });
  return employer;
}

const plans = () => Plan.find({ active: true }).sort({ sortOrder: 1 }).lean();
const invoices = (employerId) => Payment.find({ employerId, status: { $in: ['paid', 'refunded'] } }).populate('planId', 'name').sort({ createdAt: -1 }).lean();

module.exports = { plans, createOrder, verifyPayment, webhook, refund, adjustCredits, invoices, priceFor, fulfil };
