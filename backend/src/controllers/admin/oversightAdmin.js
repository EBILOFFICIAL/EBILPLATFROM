const h = require('../../utils/asyncHandler');
const { ok } = require('../../utils/response');
const { paginate } = require('../../utils/pagination');
const audit = require('../../services/auditService');
const separations = require('../../services/separationService');
const exits = require('../../services/exitAssessmentService');
const offers = require('../../services/offerService');
const Offer = require('../../models/Offer');
const ReferenceRequest = require('../../models/ReferenceRequest');
const Job = require('../../models/Job');
const Application = require('../../models/Application');

module.exports = {
  offers: h(async (req, res) => { const r = await paginate(Offer, req.query.status ? { status: req.query.status } : {}, req.query, { populate: [{ path: 'employeeId', select: 'fullName eibilId' }, { path: 'employerId', select: 'companyName' }] }); ok(res, r.items, 'OK', r.meta); }),
  verifyOffer: h(async (req, res) => {
    const o = await Offer.findById(req.params.id);
    o.verified = true;
    o.stateHistory.push({ status: o.status, by: req.user._id, at: new Date(), note: 'Verified by admin' });
    await o.save();
    await audit.log({ req, action: 'offer.admin_verified', entityType: 'Offer', entityId: o._id });
    ok(res, o, 'Offer verified');
  }),
  runOfferJob: h(async (req, res) => ok(res, await offers.processNoShows(), 'No-show processing complete')),
  separations: h(async (req, res) => ok(res, await separations.withAssessment(req.query.status ? { status: req.query.status } : {}))),
  resolveDates: h(async (req, res) => { const sc = await separations.resolveDates(req.params.id, req.body); await audit.log({ req, action: 'separation.dates_resolved', entityType: 'SeparationCase', entityId: sc._id }); ok(res, sc, 'Dates resolved'); }),
  reviewSeparation: h(async (req, res) => { const sc = await exits.adminReview(req.params.id, req.body.approve, req.body.note); await audit.log({ req, action: `separation.admin_${req.body.approve ? 'approved' : 'rejected'}`, entityType: 'SeparationCase', entityId: sc._id }); ok(res, sc, 'Review recorded'); }),
  forcePublish: h(async (req, res) => {
    const sc = await require('../../models/SeparationCase').findById(req.params.id);
    const r = sc.status === 'review_window' && (!['termination_misconduct', 'absconded'].includes(sc.separationType) || sc.adminReviewed) ? await exits.publish(sc) : sc;
    await audit.log({ req, action: 'separation.force_publish', entityType: 'SeparationCase', entityId: sc._id });
    ok(res, r, r.status === 'published' ? 'Published' : 'Cannot publish in current state (misconduct needs admin review first)');
  }),
  references: h(async (req, res) => {
    const rows = await ReferenceRequest.find().populate('requesterEmployerId previousEmployerId', 'companyName').populate('employeeId', 'fullName eibilId').sort({ createdAt: -1 }).limit(200).lean();
    ok(res, rows.map((r) => ({ ...r, slaBreached: r.status !== 'completed' && r.dueAt < new Date() })));
  }),
  jobs: h(async (req, res) => { const r = await paginate(Job, req.query.status ? { status: req.query.status } : {}, req.query, { populate: { path: 'employerId', select: 'companyName' } }); ok(res, r.items, 'OK', r.meta); }),
  moderateJob: h(async (req, res) => {
    const data = {};
    if (req.body.status) data.status = req.body.status;
    if (req.body.featured !== undefined) data.featured = req.body.featured;
    if (req.body.note) data.moderationNote = req.body.note;
    const j = await Job.findByIdAndUpdate(req.params.id, data, { new: true });
    await audit.log({ req, action: 'job.moderated', entityType: 'Job', entityId: j._id, after: data });
    ok(res, j, 'Job updated');
  }),
  applications: h(async (req, res) => { const r = await paginate(Application, {}, req.query, { populate: [{ path: 'jobId', select: 'title' }, { path: 'employeeId', select: 'fullName eibilId' }] }); ok(res, r.items, 'OK', r.meta); }),
};
