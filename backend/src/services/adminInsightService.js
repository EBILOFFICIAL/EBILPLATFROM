const mongoose = require('mongoose');
const EmployeeProfile = require('../models/EmployeeProfile');
const Employer = require('../models/Employer');
const EmployerUser = require('../models/EmployerUser');
const EmploymentRecord = require('../models/EmploymentRecord');
const Evaluation = require('../models/Evaluation');
const ScoreEvent = require('../models/ScoreEvent');
const Application = require('../models/Application');
const Job = require('../models/Job');
const Dispute = require('../models/Dispute');
const Offer = require('../models/Offer');
const SeparationCase = require('../models/SeparationCase');
const FraudFlag = require('../models/FraudFlag');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { VerificationCheck, CreditTransaction } = require('../models/misc');
const AppError = require('../utils/AppError');
const { withDateRange } = require('../utils/pagination');
const { PIPELINE } = require('../constants');

const rx = (q) => new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
const SORTS = { score_desc: { currentScore: -1 }, score_asc: { currentScore: 1 }, newest: { createdAt: -1 }, oldest: { createdAt: 1 }, name: { fullName: 1 } };

async function listEmployees(query) {
  const filter = { isShell: { $ne: true } };
  if (query.q) {
    const users = await User.find({ $or: [{ email: rx(query.q) }, { mobile: rx(query.q) }] }).select('_id').lean();
    filter.$or = [{ fullName: rx(query.q) }, { eibilId: rx(query.q) }, { location: rx(query.q) }, { userId: { $in: users.map((u) => u._id) } }];
  }
  if (query.band) filter.band = query.band;
  if (query.panVerified) filter.panVerified = query.panVerified === 'true';
  if (query.openToWork) filter.openToWork = query.openToWork === 'true';
  if (query.scoreMin || query.scoreMax) filter.currentScore = { ...(query.scoreMin && { $gte: Number(query.scoreMin) }), ...(query.scoreMax && { $lte: Number(query.scoreMax) }) };
  if (query.employerId && mongoose.isValidObjectId(query.employerId)) {
    const ids = await EmploymentRecord.distinct('employeeId', { employerId: query.employerId, isCurrent: true });
    filter._id = { $in: ids };
  }
  const f = withDateRange(filter, query);
  const exporting = query.export === '1';
  const limit = Math.min(exporting ? 5000 : 100, Number(query.limit) || 20);
  const page = Math.max(1, Number(query.page) || 1);
  const [items, total] = await Promise.all([
    EmployeeProfile.find(f).sort(SORTS[query.sort] || SORTS.newest).skip((page - 1) * limit).limit(limit).populate('userId', 'email mobile status').lean(),
    EmployeeProfile.countDocuments(f),
  ]);
  const ids = items.map((p) => p._id);
  const [current, apps] = await Promise.all([
    EmploymentRecord.find({ employeeId: { $in: ids }, isCurrent: true }).populate('employerId', 'companyName').lean(),
    Application.aggregate([{ $match: { employeeId: { $in: ids } } }, { $group: { _id: '$employeeId', n: { $sum: 1 } } }]),
  ]);
  const rows = items.map((p) => {
    const job = current.find((r) => String(r.employeeId) === String(p._id));
    return {
      _id: p._id, eibilId: p.eibilId, fullName: p.fullName, email: p.userId?.email, phone: p.userId?.mobile, city: p.location, accountStatus: p.userId?.status,
      currentScore: p.currentScore ?? null, band: p.band ?? null, panVerified: p.panVerified, panStatus: p.panStatus, panMasked: p.panMasked,
      currentEmployer: job?.employerId?.companyName || null, currentEmployerId: job?.employerId?._id || null, designation: job?.designation || null,
      applications: apps.find((a) => String(a._id) === String(p._id))?.n || 0, openToWork: p.openToWork, createdAt: p.createdAt,
    };
  });
  return { items: rows, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function employeeOverview(id) {
  if (!mongoose.isValidObjectId(id)) throw AppError.badRequest('Invalid id');
  const profile = await EmployeeProfile.findById(id).select('-panEncrypted -panHash').lean();
  if (!profile) throw AppError.notFound('Employee not found');
  const [user, scoreEvents, employment, evaluations, applications, viewers, disputes, offers, separations, flags] = await Promise.all([
    User.findById(profile.userId).select('name email mobile status emailVerified lastLogin createdAt').lean(),
    ScoreEvent.find({ employeeId: id }).sort({ createdAt: 1 }).lean(),
    EmploymentRecord.find({ employeeId: id }).populate('employerId', 'companyName').sort({ startDate: -1 }).lean(),
    Evaluation.find({ employeeId: id }).populate('employerId', 'companyName').sort({ createdAt: -1 }).lean(),
    Application.find({ employeeId: id }).populate('jobId', 'title location status').populate('employerId', 'companyName').populate('resumeId', 'fileName').sort({ createdAt: -1 }).lean(),
    VerificationCheck.find({ employeeId: id, employerId: { $ne: null } }).populate('employerId', 'companyName').populate('viewerUserId', 'name').select('-snapshot').sort({ createdAt: -1 }).lean(),
    Dispute.find({ employeeId: id }).sort({ createdAt: -1 }).lean(),
    Offer.find({ employeeId: id }).populate('employerId', 'companyName').sort({ createdAt: -1 }).lean(),
    SeparationCase.find({ employeeId: id }).populate('employerId', 'companyName').sort({ createdAt: -1 }).lean(),
    FraudFlag.find({ employeeId: id }).sort({ createdAt: -1 }).lean(),
  ]);
  const trend = scoreEvents.map((e) => ({ at: e.createdAt, score: e.newScore }));
  return { profile, user, trend, scoreEvents: scoreEvents.slice().reverse(), employment, evaluations, applications, viewers, disputes, offers, separations, flags };
}

async function employerOverview(id) {
  if (!mongoose.isValidObjectId(id)) throw AppError.badRequest('Invalid id');
  const employer = await Employer.findById(id).select('-companyPanEncrypted -companyPanHash').lean();
  if (!employer) throw AppError.notFound('Employer not found');
  const [members, jobs, applications, roster, evaluations, reports, payments, credits] = await Promise.all([
    EmployerUser.find({ employerId: id }).populate('userId', 'name email mobile status lastLogin').lean(),
    Job.find({ employerId: id }).sort({ createdAt: -1 }).lean(),
    Application.find({ employerId: id }).populate('employeeId', 'fullName eibilId currentScore band location userId').populate('jobId', 'title').populate('resumeId', 'fileName').sort({ createdAt: -1 }).lean(),
    EmploymentRecord.find({ employerId: id }).populate('employeeId', 'fullName eibilId currentScore band').sort({ startDate: -1 }).lean(),
    Evaluation.find({ employerId: id }).populate('employeeId', 'fullName eibilId').sort({ createdAt: -1 }).lean(),
    VerificationCheck.find({ employerId: id }).populate('employeeId', 'fullName eibilId currentScore').populate('viewerUserId', 'name').select('-snapshot').sort({ createdAt: -1 }).lean(),
    Payment.find({ employerId: id }).sort({ createdAt: -1 }).lean(),
    CreditTransaction.find({ employerId: id }).sort({ createdAt: -1 }).lean(),
  ]);
  const users = await User.find({ _id: applications.map((a) => a.employeeId?.userId).filter(Boolean) }).select('email mobile').lean();
  applications.forEach((a) => {
    const u = users.find((x) => String(x._id) === String(a.employeeId?.userId));
    if (a.employeeId) Object.assign(a.employeeId, { email: u?.email, phone: u?.mobile, city: a.employeeId.location });
  });
  const counts = applications.reduce((m, a) => { const k = String(a.jobId?._id); m[k] = (m[k] || 0) + 1; return m; }, {});
  jobs.forEach((j) => { j.applicantCount = counts[String(j._id)] || 0; });
  return { employer, members, jobs, applications, roster, evaluations, reports, payments, credits };
}

async function listApplications(query) {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.employerId && mongoose.isValidObjectId(query.employerId)) filter.employerId = query.employerId;
  if (query.employeeId && mongoose.isValidObjectId(query.employeeId)) filter.employeeId = query.employeeId;
  if (query.q) {
    const [emps, jobs] = await Promise.all([EmployeeProfile.find({ $or: [{ fullName: rx(query.q) }, { eibilId: rx(query.q) }] }).select('_id').lean(), Job.find({ title: rx(query.q) }).select('_id').lean()]);
    filter.$or = [{ employeeId: { $in: emps.map((e) => e._id) } }, { jobId: { $in: jobs.map((j) => j._id) } }];
  }
  const f = withDateRange(filter, query);
  const limit = Math.min(query.export === '1' ? 5000 : 100, Number(query.limit) || 20);
  const page = Math.max(1, Number(query.page) || 1);
  const [items, total] = await Promise.all([
    Application.find(f).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('employeeId', 'fullName eibilId currentScore').populate('jobId', 'title').populate('employerId', 'companyName').lean(),
    Application.countDocuments(f),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function setApplicationStatus(id, status, user, note) {
  if (!PIPELINE.includes(status)) throw AppError.badRequest('Invalid status');
  const app = await Application.findById(id);
  if (!app) throw AppError.notFound('Application not found');
  const before = app.status;
  app.status = status;
  app.history.push({ status, by: user._id, at: new Date() });
  if (note) app.notes.push({ text: `[Admin] ${note}`, by: user._id, at: new Date() });
  await app.save();
  const p = await EmployeeProfile.findById(app.employeeId).lean();
  if (p?.userId) await require('./notificationService').notify(p.userId, { title: 'Application update', body: `Your application status changed to ${status}`, link: '/employee/applications' });
  return { app, before };
}

module.exports = { listEmployees, employeeOverview, employerOverview, listApplications, setApplicationStatus };
