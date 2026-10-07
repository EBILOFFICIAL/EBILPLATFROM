const h = require('../../utils/asyncHandler');
const { ok } = require('../../utils/response');
const AppError = require('../../utils/AppError');
const admin = require('../../services/adminService');
const audit = require('../../services/auditService');
const billing = require('../../services/billingService');
const trust = require('../../services/employerTrustService');
const notify = require('../../services/notificationService');
const Employer = require('../../models/Employer');
const EmployerTrustMetric = require('../../models/EmployerTrustMetric');

module.exports = {
  list: h(async (req, res) => { const r = await admin.listEmployers(req.query); ok(res, r.items, 'OK', r.meta); }),
  detail: h(async (req, res) => ok(res, await admin.employerDetail(req.params.id))),
  kyc: h(async (req, res) => {
    const { kycStatus, note } = req.body;
    if (!['approved', 'rejected', 'suspended', 'pending'].includes(kycStatus)) throw AppError.badRequest('Invalid KYC status');
    const before = await Employer.findById(req.params.id).lean();
    const e = await Employer.findByIdAndUpdate(req.params.id, { kycStatus, kycNotes: note || before.kycNotes, status: kycStatus === 'suspended' ? 'suspended' : 'active' }, { new: true });
    await audit.log({ req, action: `employer.kyc_${kycStatus}`, entityType: 'Employer', entityId: e._id, before: { kycStatus: before.kycStatus }, after: { kycStatus } });
    await notify.notifyEmployer(e._id, { title: `Company KYC ${kycStatus}`, body: note || `Your company verification status is now ${kycStatus}`, link: '/employer', email: true });
    ok(res, e, `Employer ${kycStatus}`);
  }),
  update: h(async (req, res) => {
    const allowed = ['trustTier', 'planId', 'planExpiresAt', 'status'];
    const data = Object.fromEntries(allowed.filter((k) => req.body[k] !== undefined).map((k) => [k, req.body[k]]));
    const e = await Employer.findByIdAndUpdate(req.params.id, data, { new: true });
    await audit.log({ req, action: 'employer.updated', entityType: 'Employer', entityId: e._id, after: data });
    ok(res, e, 'Employer updated');
  }),
  credits: h(async (req, res) => {
    const e = await billing.adjustCredits(req.params.id, Number(req.body.amount), req.body.reason || 'Admin adjustment', req.user._id);
    await audit.log({ req, action: 'employer.credits_adjusted', entityType: 'Employer', entityId: req.params.id, meta: { amount: req.body.amount } });
    ok(res, e, 'Credits adjusted');
  }),
  trustList: h(async (req, res) => ok(res, await EmployerTrustMetric.find().populate('employerId', 'companyName trustTier').sort({ trustIndex: 1 }).lean())),
  trustAdjust: h(async (req, res) => {
    const m = await trust.adjust(req.params.id, Number(req.body.manualAdjustment));
    await audit.log({ req, action: 'employer.trust_adjusted', entityType: 'Employer', entityId: req.params.id, meta: { manualAdjustment: req.body.manualAdjustment } });
    ok(res, m, 'Trust index adjusted');
  }),
};
