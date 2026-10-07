const bcrypt = require('bcryptjs');
const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');
const Employer = require('../models/Employer');
const EmployerUser = require('../models/EmployerUser');
const FraudFlag = require('../models/FraudFlag');
const { Session } = require('../models/misc');
const AppError = require('../utils/AppError');
const { paginate } = require('../utils/pagination');
const scoreEvents = require('./scoreEventService');
const reports = require('./reportService');
const employeeService = require('./employeeService');

async function listUsers(query) {
  const filter = {};
  if (query.role) filter.role = query.role;
  if (query.status) filter.status = query.status;
  if (query.q) filter.$or = [{ name: new RegExp(query.q, 'i') }, { email: new RegExp(query.q, 'i') }];
  const r = await paginate(User, filter, query);
  const profiles = await EmployeeProfile.find({ userId: { $in: r.items.map((u) => u._id) } }).select('userId eibilId panMasked panStatus currentScore band scorePaused').lean();
  r.items = r.items.map((u) => ({ ...u, profile: profiles.find((p) => String(p.userId) === String(u._id)) || null }));
  return r;
}

async function userDetail(id) {
  const user = await User.findById(id).lean();
  if (!user) throw AppError.notFound();
  const profile = await EmployeeProfile.findOne({ userId: id }).lean();
  const membership = await EmployerUser.findOne({ userId: id }).populate('employerId').lean();
  return { user, profile, membership, scoreHistory: profile ? await scoreEvents.history(profile._id) : [], flags: profile ? await FraudFlag.find({ employeeId: profile._id }).lean() : [] };
}

async function setStatus(id, status) {
  const user = await User.findByIdAndUpdate(id, { status }, { new: true });
  if (status !== 'active') await Session.updateMany({ userId: id }, { revoked: true });
  return user;
}

const forceLogout = (id) => Session.updateMany({ userId: id }, { revoked: true });

async function forcePasswordReset(id) {
  await User.updateOne({ _id: id }, { mustResetPassword: true });
  return forceLogout(id);
}

async function impersonate(userId) {
  const profile = await EmployeeProfile.findOne({ userId }).lean();
  if (!profile) throw AppError.badRequest('Read-only impersonation is available for employee profiles');
  return { readOnly: true, report: await reports.build(profile._id, {}) };
}

async function setScorePaused(profileId, paused) {
  return EmployeeProfile.findByIdAndUpdate(profileId, { scorePaused: paused }, { new: true });
}

async function mergeDuplicate(keepProfileId, removeProfileId) {
  const remove = await EmployeeProfile.findById(removeProfileId);
  if (!remove) throw AppError.notFound();
  if (remove.userId) await setStatus(remove.userId, 'banned');
  await FraudFlag.updateMany({ employeeId: removeProfileId, status: 'open' }, { status: 'resolved', resolutionNote: `Merged into ${keepProfileId}` });
  return { kept: keepProfileId, deactivated: removeProfileId };
}

async function dpdpExport(userId) {
  const user = await User.findById(userId);
  const profile = await EmployeeProfile.findOne({ userId });
  if (!profile) throw AppError.badRequest('No employee profile');
  return employeeService.exportData(profile, user);
}

async function dpdpErase(userId) {
  const user = await User.findById(userId);
  if (!user) throw AppError.notFound();
  Object.assign(user, { name: 'Erased User', email: `erased-${user._id}@erased.eibil`, mobile: undefined, status: 'banned' });
  await user.save();
  await EmployeeProfile.updateOne({ userId }, { fullName: 'Erased User', photo: null, location: null, headline: null, skills: [], education: [], openToWork: false, resumeUrl: null });
  await forceLogout(userId);
  return { erased: true, note: 'Personal data anonymised. Ledger records retained as required by law (hash-only).' };
}

async function createAdmin({ name, email, password, adminRoleId }) {
  if (await User.exists({ email: email.toLowerCase() })) throw AppError.conflict('Email already in use');
  return User.create({ role: 'admin', name, email, adminRoleId, emailVerified: true, passwordHash: await bcrypt.hash(password, 12), mustResetPassword: true });
}

async function listEmployers(query) {
  const filter = {};
  if (query.kycStatus) filter.kycStatus = query.kycStatus;
  if (query.q) filter.companyName = new RegExp(query.q, 'i');
  return paginate(Employer, filter, query, { populate: 'planId' });
}

async function employerDetail(id) {
  const employer = await Employer.findById(id).populate('planId').lean();
  if (!employer) throw AppError.notFound();
  const members = await EmployerUser.find({ employerId: id }).populate('userId', 'name email status').lean();
  return { employer, members, trust: await require('./employerTrustService').get(id) };
}

module.exports = { listUsers, userDetail, setStatus, forceLogout, forcePasswordReset, impersonate, setScorePaused, mergeDuplicate, dpdpExport, dpdpErase, createAdmin, listEmployers, employerDetail };
