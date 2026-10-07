const h = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const cms = require('../services/cmsService');
const reports = require('../services/reportService');
const offers = require('../services/offerService');
const tickets = require('../services/ticketService');
const settings = require('../services/settingsService');
const upload = require('../services/uploadService');
const EmployeeProfile = require('../models/EmployeeProfile');
const Employer = require('../models/Employer');
const Evaluation = require('../models/Evaluation');
const Plan = require('../models/Plan');

module.exports = {
  cms: h(async (req, res) => ok(res, await cms.getPublic(req.params.slug))),
  cmsList: h(async (req, res) => ok(res, await cms.listPublic(req.query.type))),
  stats: h(async (req, res) => ok(res, {
    verifiedProfiles: await EmployeeProfile.countDocuments({ panVerified: true }),
    employers: await Employer.countDocuments({ kycStatus: 'approved' }),
    evaluations: await Evaluation.countDocuments({ status: 'accepted' }),
  })),
  plans: h(async (req, res) => ok(res, await Plan.find({ active: true }).sort({ sortOrder: 1 }).lean())),
  site: h(async (req, res) => ok(res, { announcement: await settings.get('announcement'), featureFlags: await settings.get('featureFlags') })),
  contact: h(async (req, res) => created(res, await tickets.create(null, { subject: `Contact: ${req.body.type || 'general'} from ${req.body.name}${req.body.company ? ` (${req.body.company})` : ''}`, category: 'contact', message: req.body.message, email: req.body.email }), 'Thanks! Our team will reach out shortly')),
  reportVerify: h(async (req, res) => ok(res, await reports.publicVerify(req.params.token))),
  offerConfirm: h(async (req, res) => ok(res, await offers.confirmByToken(req.params.token), 'Offer confirmed by issuing company')),
  file: h(async (req, res) => {
    const { doc, buffer } = await upload.readSigned(req.params.id, req.query.exp, req.query.sig);
    res.set({ 'Content-Type': doc.mimeType, 'Content-Disposition': `inline; filename="${doc.name}"` });
    res.send(buffer);
  }),
};
