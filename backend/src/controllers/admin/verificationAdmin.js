const h = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/response');
const { paginate } = require('../../utils/pagination');
const pan = require('../../services/panService');
const audit = require('../../services/auditService');
const EmployeeProfile = require('../../models/EmployeeProfile');
const FraudFlag = require('../../models/FraudFlag');
const { Watchlist, Document } = require('../../models/misc');
const upload = require('../../services/uploadService');
const { hashPan } = require('../../utils/panUtils');

module.exports = {
  queue: h(async (req, res) => {
    const rows = await EmployeeProfile.find({ panStatus: 'pending_review' }).populate('userId', 'email name').sort({ updatedAt: 1 }).lean();
    ok(res, rows.map((p) => ({ ...p, slaHoursOpen: Math.round((Date.now() - new Date(p.updatedAt)) / 3600e3) })));
  }),
  decide: h(async (req, res) => {
    const ids = req.body.ids || [req.params.id];
    const out = [];
    for (const id of ids) out.push(await pan.adminDecision(id, req.body.approve, req.body.reason, req));
    ok(res, out, `${out.length} profile(s) ${req.body.approve ? 'approved' : 'rejected'}`);
  }),
  documents: h(async (req, res) => {
    const docs = await Document.find(req.query.status ? { status: req.query.status } : {}).populate('ownerId', 'name email').sort({ createdAt: -1 }).limit(100).lean();
    ok(res, docs.map((d) => ({ ...d, url: upload.signedUrl(d._id) })));
  }),
  documentDecision: h(async (req, res) => {
    const d = await Document.findByIdAndUpdate(req.params.id, { status: req.body.approve ? 'approved' : 'rejected' }, { new: true });
    await audit.log({ req, action: `document.${d.status}`, entityType: 'Document', entityId: d._id, meta: { reason: req.body.reason } });
    ok(res, d, `Document ${d.status}`);
  }),
  flags: h(async (req, res) => {
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.status) filter.status = req.query.status;
    const r = await paginate(FraudFlag, filter, req.query, { populate: [{ path: 'employeeId', select: 'fullName eibilId panMasked' }, { path: 'employerId', select: 'companyName' }] });
    ok(res, r.items, 'OK', r.meta);
  }),
  updateFlag: h(async (req, res) => {
    const f = await FraudFlag.findByIdAndUpdate(req.params.id, { status: req.body.status, resolutionNote: req.body.note, resolvedBy: req.user._id }, { new: true });
    await audit.log({ req, action: `fraud.${req.body.status}`, entityType: 'FraudFlag', entityId: f._id });
    ok(res, f, 'Flag updated');
  }),
  watchlist: h(async (req, res) => ok(res, await Watchlist.find().sort({ createdAt: -1 }).lean())),
  addWatch: h(async (req, res) => {
    const value = req.body.type === 'pan' ? hashPan(req.body.value) : String(req.body.value).toLowerCase();
    const w = await Watchlist.create({ type: req.body.type, value, reason: req.body.reason, addedBy: req.user._id });
    await audit.log({ req, action: 'watchlist.added', entityType: 'Watchlist', entityId: w._id, meta: { type: w.type } });
    created(res, { ...w.toObject(), value: req.body.type === 'pan' ? 'PAN (hashed)' : w.value }, 'Added to watchlist');
  }),
  removeWatch: h(async (req, res) => { await Watchlist.deleteOne({ _id: req.params.id }); await audit.log({ req, action: 'watchlist.removed', entityType: 'Watchlist', entityId: req.params.id }); ok(res, null, 'Removed'); }),
};
