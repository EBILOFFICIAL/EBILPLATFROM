const Job = require('../models/Job');
const Application = require('../models/Application');
const EmployeeProfile = require('../models/EmployeeProfile');
const Plan = require('../models/Plan');
const AppError = require('../utils/AppError');
const { paginate } = require('../utils/pagination');
const settings = require('./settingsService');
const consent = require('./consentService');
const notify = require('./notificationService');
const trust = require('./employerTrustService');

const FIELDS = ['title', 'description', 'location', 'type', 'role', 'skills', 'salaryMin', 'salaryMax', 'experienceMin', 'experienceMax', 'minEibilScore', 'screeningQuestions', 'expiresAt'];
const pick = (d) => Object.fromEntries(FIELDS.filter((f) => d[f] !== undefined).map((f) => [f, d[f]]));

async function publicList(query) {
  const filter = { status: 'active' };
  if (query.q) filter.$text = { $search: query.q };
  if (query.location) filter.location = new RegExp(query.location, 'i');
  if (query.role) filter.role = new RegExp(query.role, 'i');
  if (query.type) filter.type = query.type;
  if (query.experience) filter.experienceMin = { $lte: Number(query.experience) };
  if (query.salary) filter.salaryMax = { $gte: Number(query.salary) };
  if (query.maxMinScore) filter.minEibilScore = { $lte: Number(query.maxMinScore) };
  const result = await paginate(Job, filter, query, { sort: { featured: -1, createdAt: -1 }, populate: { path: 'employerId', select: 'companyName city trustTier' } });
  const metrics = await require('../models/EmployerTrustMetric').find({ employerId: { $in: result.items.map((j) => j.employerId?._id) } }).lean();
  result.items = result.items.map((j) => ({ ...j, employerTrustIndex: metrics.find((m) => String(m.employerId) === String(j.employerId?._id))?.trustIndex ?? 100 }));
  return result;
}

async function getPublic(id) {
  const job = await Job.findOne({ _id: id, status: 'active' }).populate('employerId', 'companyName city industry trustTier').lean();
  if (!job) throw AppError.notFound('Job not found');
  job.employerTrustIndex = (await trust.get(job.employerId._id)).trustIndex;
  return job;
}

async function create(employer, user, data) {
  if (employer.kycStatus !== 'approved') throw AppError.forbidden('Employer must be approved before posting jobs');
  const plan = employer.planId ? await Plan.findById(employer.planId).lean() : null;
  const active = await Job.countDocuments({ employerId: employer._id, status: { $in: ['active', 'pending_approval'] } });
  if (active >= (plan?.jobPosts ?? 1)) throw new AppError('Job post limit reached for your plan. Upgrade to post more', 402);
  const needsApproval = await settings.get('jobsRequireApproval');
  employer.jobPostsUsed += 1;
  await employer.save();
  return Job.create({ ...pick(data), employerId: employer._id, postedBy: user._id, status: needsApproval ? 'pending_approval' : 'active' });
}

async function update(employer, id, data) {
  const job = await Job.findOne({ _id: id, employerId: employer._id });
  if (!job) throw AppError.notFound();
  Object.assign(job, pick(data));
  if (data.status && ['active', 'closed'].includes(data.status) && job.status !== 'taken_down') job.status = data.status;
  return job.save();
}

async function remove(employer, id) {
  const job = await Job.findOne({ _id: id, employerId: employer._id });
  if (!job) throw AppError.notFound();
  job.status = 'closed';
  return job.save();
}

async function apply(profile, user, jobId, { answers, resumeUrl }) {
  if (!user.emailVerified || !profile.panVerified) throw AppError.forbidden('Verify your email and PAN before applying');
  const job = await Job.findOne({ _id: jobId, status: 'active' });
  if (!job) throw AppError.notFound('Job not open');
  if ((profile.currentScore || 0) < job.minEibilScore) throw AppError.forbidden(`This job requires an EIBIL score of ${job.minEibilScore}+`);
  if (await Application.exists({ jobId, employeeId: profile._id })) throw AppError.conflict('You have already applied');
  const grant = await consent.grantFromApplication(profile._id, job.employerId);
  const app = await Application.create({ jobId, employerId: job.employerId, employeeId: profile._id, answers, resumeUrl: resumeUrl || profile.resumeUrl, scoreAtApply: profile.currentScore, bandAtApply: profile.band, consentId: grant?._id, history: [{ status: 'applied', by: user._id, at: new Date() }] });
  job.applicantsCount += 1;
  await job.save();
  await notify.notifyEmployer(job.employerId, { title: 'New applicant', body: `${profile.fullName} applied to ${job.title}`, link: `/employer/jobs/${job._id}` });
  return app;
}

const myApplications = (profileId) => Application.find({ employeeId: profileId }).populate({ path: 'jobId', select: 'title location employerId status', populate: { path: 'employerId', select: 'companyName' } }).sort({ createdAt: -1 }).lean();
const employerJobs = (employerId) => Job.find({ employerId }).sort({ createdAt: -1 }).lean();

async function applicants(employer, jobId) {
  const job = await Job.findOne({ _id: jobId, employerId: employer._id }).lean();
  if (!job) throw AppError.notFound();
  const apps = await Application.find({ jobId }).populate('employeeId', 'fullName eibilId currentScore band headline skills experienceYears location').sort({ createdAt: -1 }).lean();
  return { job, applicants: apps };
}

async function setStatus(employer, user, appIds, status, note) {
  const ids = Array.isArray(appIds) ? appIds : [appIds];
  const apps = await Application.find({ _id: { $in: ids }, employerId: employer._id });
  if (!apps.length) throw AppError.notFound();
  for (const app of apps) {
    app.status = status;
    app.history.push({ status, by: user._id, at: new Date() });
    if (note) app.notes.push({ text: note, by: user._id, at: new Date() });
    await app.save();
    const p = await EmployeeProfile.findById(app.employeeId).lean();
    if (p?.userId) await notify.notify(p.userId, { title: 'Application update', body: `Your application status changed to ${status}`, link: '/employee/applications' });
  }
  return apps;
}

async function toggleSave(profile, jobId) {
  const has = profile.savedJobIds.map(String).includes(String(jobId));
  profile.savedJobIds = has ? profile.savedJobIds.filter((j) => String(j) !== String(jobId)) : [...profile.savedJobIds, jobId];
  await profile.save();
  return { saved: !has };
}

const savedJobs = (profile) => Job.find({ _id: { $in: profile.savedJobIds } }).populate('employerId', 'companyName').lean();

module.exports = { publicList, getPublic, create, update, remove, apply, myApplications, employerJobs, applicants, setStatus, toggleSave, savedJobs };
