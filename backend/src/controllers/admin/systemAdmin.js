const h = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/response');
const { crud } = require('../../services/crudService');
const audit = require('../../services/auditService');
const billing = require('../../services/billingService');
const settings = require('../../services/settingsService');
const tickets = require('../../services/ticketService');
const notify = require('../../services/notificationService');
const queue = require('../../config/queue');
const generic = require('../../templates/email/generic');
const Plan = require('../../models/Plan');
const Payment = require('../../models/Payment');
const Ticket = require('../../models/Ticket');
const User = require('../../models/User');
const { Coupon, Broadcast } = require('../../models/misc');

const resource = (Model, name, opts) => {
  const svc = crud(Model, opts);
  return {
    list: h(async (req, res) => { const r = await svc.list(req.query); ok(res, r.items, 'OK', r.meta); }),
    get: h(async (req, res) => ok(res, await svc.get(req.params.id))),
    create: h(async (req, res) => { const d = await svc.create(req.body); await audit.log({ req, action: `${name}.created`, entityType: name, entityId: d._id }); created(res, d, 'Created'); }),
    update: h(async (req, res) => { const { before, after } = await svc.update(req.params.id, req.body); await audit.log({ req, action: `${name}.updated`, entityType: name, entityId: req.params.id, before, after }); ok(res, after, 'Updated'); }),
    remove: h(async (req, res) => { await svc.remove(req.params.id); await audit.log({ req, action: `${name}.deleted`, entityType: name, entityId: req.params.id }); ok(res, null, 'Deleted'); }),
  };
};

module.exports = {
  questions: resource(require('../../models/Question'), 'Question', { searchFields: ['text'], defaultSort: { dimension: 1, order: 1 } }),
  plans: resource(Plan, 'Plan', { searchFields: ['name', 'code'], defaultSort: { sortOrder: 1 } }),
  coupons: resource(Coupon, 'Coupon', { searchFields: ['code'] }),
  payments: h(async (req, res) => { const r = await crud(Payment, { populate: [{ path: 'employerId', select: 'companyName gstin' }, { path: 'planId', select: 'name' }] }).list(req.query); ok(res, r.items, 'OK', r.meta); }),
  refund: h(async (req, res) => { const p = await billing.refund(req.params.id); await audit.log({ req, action: 'payment.refunded', entityType: 'Payment', entityId: p._id }); ok(res, p, 'Refund processed'); }),
  gstReport: h(async (req, res) => {
    const rows = await Payment.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$paidAt' } }, taxable: { $sum: { $subtract: ['$baseAmount', '$discount'] } }, gst: { $sum: '$gstAmount' }, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }, { $sort: { _id: -1 } }]);
    ok(res, rows);
  }),
  settings: h(async (req, res) => ok(res, await settings.list())),
  updateSetting: h(async (req, res) => { const before = await settings.get(req.params.key); await settings.set(req.params.key, req.body.value); await audit.log({ req, action: 'setting.updated', entityType: 'Setting', entityId: req.params.key, before, after: req.body.value }); ok(res, { key: req.params.key, value: req.body.value }, 'Setting saved'); }),
  health: h(async (req, res) => {
    const env = require('../../config/env');
    const mongoose = require('mongoose');
    ok(res, {
      mongo: mongoose.connection.readyState === 1 ? 'up' : 'down', queueMode: queue.getMode(), uptimeSec: Math.round(process.uptime()), memoryMb: Math.round(process.memoryUsage().rss / 1e6),
      providers: { pan: env.panProvider, kyc: env.kycProvider, email: env.emailProvider, sms: env.smsProvider, storage: env.storageProvider, razorpay: require('../../config/razorpay').isMock ? 'mock' : 'live' },
    });
  }),
  tickets: resource(Ticket, 'Ticket', { searchFields: ['subject', 'ticketNo', 'email'] }),
  replyTicket: h(async (req, res) => ok(res, await tickets.reply(req.params.id, req.user, req.body, true), 'Reply saved')),
  broadcasts: h(async (req, res) => ok(res, await Broadcast.find().sort({ createdAt: -1 }).lean())),
  sendBroadcast: h(async (req, res) => {
    const { segment = 'all', title, body, sendEmail } = req.body;
    const roleMap = { employees: 'employee', employers: 'employer', admins: 'admin' };
    const users = await User.find({ status: 'active', ...(roleMap[segment] ? { role: roleMap[segment] } : {}) }).select('_id email name').lean();
    for (const u of users) {
      await notify.notify(u._id, { title, body });
      if (sendEmail) await queue.enqueue('email.send', { to: u.email, ...generic({ name: u.name, title, body }) });
    }
    const b = await Broadcast.create({ segment, title, body, sendEmail, delivered: users.length, sentBy: req.user._id });
    await audit.log({ req, action: 'broadcast.sent', entityType: 'Broadcast', entityId: b._id, meta: { segment, delivered: users.length } });
    created(res, b, `Delivered to ${users.length} users`);
  }),
};
