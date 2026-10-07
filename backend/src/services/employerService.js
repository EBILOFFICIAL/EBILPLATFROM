const bcrypt = require('bcryptjs');
const Employer = require('../models/Employer');
const EmployerUser = require('../models/EmployerUser');
const User = require('../models/User');
const EmploymentRecord = require('../models/EmploymentRecord');
const EmployeeProfile = require('../models/EmployeeProfile');
const Evaluation = require('../models/Evaluation');
const Application = require('../models/Application');
const Job = require('../models/Job');
const SeparationCase = require('../models/SeparationCase');
const { CreditTransaction, VerificationCheck } = require('../models/misc');
const AppError = require('../utils/AppError');
const { randomToken } = require('../utils/crypto');
const queue = require('../config/queue');
const generic = require('../templates/email/generic');
const evaluation = require('./evaluationService');
const settings = require('./settingsService');
const trust = require('./employerTrustService');

const EDITABLE = ['companyName', 'industry', 'city', 'hrContactName', 'phone'];

async function context(userId) {
  const eu = await EmployerUser.findOne({ userId }).lean();
  if (!eu) throw AppError.forbidden('No employer membership');
  const employer = await Employer.findById(eu.employerId);
  return { employer, membership: eu };
}

async function updateProfile(employer, data) {
  EDITABLE.forEach((k) => { if (data[k] !== undefined) employer[k] = data[k]; });
  return employer.save();
}

async function dashboard(employer) {
  const period = evaluation.currentPeriod(await settings.get('evaluationCycle'));
  const roster = await EmploymentRecord.find({ employerId: employer._id, status: 'verified', isCurrent: true }).lean();
  const rated = await Evaluation.find({ employerId: employer._id, period }).distinct('employeeId');
  const [pendingVerifications, applicants, openSeparations, metric] = await Promise.all([
    EmploymentRecord.countDocuments({ employerId: employer._id, status: 'declared' }),
    Application.countDocuments({ employerId: employer._id, status: 'applied' }),
    SeparationCase.countDocuments({ employerId: employer._id, status: { $nin: ['published', 'not_submitted'] } }),
    trust.get(employer._id),
  ]);
  return { period, kycStatus: employer.kycStatus, creditBalance: employer.creditBalance, pendingVerifications, evaluationsDue: roster.filter((r) => !rated.map(String).includes(String(r.employeeId))).length, rosterSize: roster.length, applicants, openSeparations, trustIndex: metric.trustIndex, activeJobs: await Job.countDocuments({ employerId: employer._id, status: 'active' }) };
}

const roster = (employer, status) => EmploymentRecord.find({ employerId: employer._id, ...(status ? { status } : {}) }).populate('employeeId', 'fullName eibilId panMasked currentScore band panVerified isShell').sort({ createdAt: -1 }).lean();

async function team(employer) {
  const members = await EmployerUser.find({ employerId: employer._id }).populate('userId', 'name email status lastLogin').lean();
  return members;
}

async function invite(employer, { name, email, role }) {
  const domain = email.split('@')[1]?.toLowerCase();
  if (employer.domain && domain !== employer.domain) throw AppError.badRequest(`Team members must use an @${employer.domain} email`);
  if (await User.exists({ email: email.toLowerCase() })) throw AppError.conflict('User with this email already exists');
  const tempPassword = `Eibil@${randomToken(4)}`;
  const user = await User.create({ role: 'employer', name, email, passwordHash: await bcrypt.hash(tempPassword, 12), mustResetPassword: true });
  const member = await EmployerUser.create({ employerId: employer._id, userId: user._id, role });
  await queue.enqueue('email.send', { to: email, ...generic({ name, title: `You're invited to ${employer.companyName} on EIBIL`, body: `Sign in at the Employer portal with ${email} and temporary password ${tempPassword}. You'll be asked to verify your email.` }) });
  return { member, tempPassword: require('../config/env').exposeDevOtp ? tempPassword : undefined };
}

async function updateMember(employer, memberId, { role }) {
  const m = await EmployerUser.findOne({ _id: memberId, employerId: employer._id });
  if (!m) throw AppError.notFound();
  if (m.role === 'Owner') throw AppError.badRequest('Owner role cannot be changed');
  m.role = role;
  return m.save();
}

async function removeMember(employer, memberId) {
  const m = await EmployerUser.findOne({ _id: memberId, employerId: employer._id });
  if (!m || m.role === 'Owner') throw AppError.badRequest('Cannot remove this member');
  await User.updateOne({ _id: m.userId }, { status: 'suspended' });
  await m.deleteOne();
}

async function talent(employer, { minScore, skills, location, experience, q }) {
  if (employer.kycStatus !== 'approved') throw AppError.forbidden('Employer must be approved to search talent');
  const filter = { openToWork: true, panVerified: true, 'visibility.hideFromEmployerIds': { $ne: employer._id } };
  if (minScore) filter.currentScore = { $gte: Number(minScore) };
  if (skills) filter.skills = { $in: String(skills).split(',').map((s) => new RegExp(s.trim(), 'i')) };
  if (location) filter.location = new RegExp(location, 'i');
  if (experience) filter.experienceYears = { $gte: Number(experience) };
  if (q) filter.$or = [{ headline: new RegExp(q, 'i') }, { fullName: new RegExp(q, 'i') }];
  const rows = await EmployeeProfile.find(filter).limit(50).lean();
  return rows.map((p) => ({ id: p._id, eibilId: p.eibilId, fullName: p.fullName, headline: p.headline, location: p.location, skills: p.skills, experienceYears: p.experienceYears, band: p.band, score: p.visibility?.showExactScore ? p.currentScore : null }));
}

async function usage(employer) {
  const [transactions, checks] = await Promise.all([
    CreditTransaction.find({ employerId: employer._id }).sort({ createdAt: -1 }).limit(50).lean(),
    VerificationCheck.find({ employerId: employer._id }).populate('employeeId', 'fullName eibilId').select('-snapshot').sort({ createdAt: -1 }).limit(50).lean(),
  ]);
  return { creditBalance: employer.creditBalance, plan: await require('../models/Plan').findById(employer.planId).lean(), jobPostsUsed: employer.jobPostsUsed, transactions, checks };
}

module.exports = { context, updateProfile, dashboard, roster, team, invite, updateMember, removeMember, talent, usage };
