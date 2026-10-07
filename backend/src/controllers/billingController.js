const h = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const billing = require('../services/billingService');

module.exports = {
  plans: h(async (req, res) => ok(res, await billing.plans())),
  subscribe: h(async (req, res) => created(res, await billing.createOrder(req.employer, req.user, req.body, 'subscription'), 'Order created')),
  purchaseCredits: h(async (req, res) => created(res, await billing.createOrder(req.employer, req.user, req.body, 'credits'), 'Order created')),
  verify: h(async (req, res) => ok(res, await billing.verifyPayment(req.employer, req.body), 'Payment successful')),
  webhook: h(async (req, res) => ok(res, await billing.webhook(req.body, req.headers['x-razorpay-signature']))),
  invoices: h(async (req, res) => ok(res, await billing.invoices(req.employer._id))),
};
