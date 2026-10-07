const bcrypt = require('bcryptjs');
const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');
const Employer = require('../models/Employer');
const EmployerUser = require('../models/EmployerUser');
const Role = require('../models/Role');
const { Session } = require('../models/misc');
const AppError = require('../utils/AppError');
const { signAccess, signRefresh, verifyRefresh, eibilId } = require('../utils/generateToken');
const { randomToken } = require('../utils/crypto');
const env = require('../config/env');
const queue = require('../config/queue');
const otp = require('./otpService');
const settings = require('./settingsService');
const duplicate = require('./duplicateService');
const kyc = require('./providers/kycProviders');
const welcome = require('../templates/email/welcome');
const { FREE_EMAIL_DOMAINS } = require('../constants');

const MAX_FAILED = 5;
const LOCK_MS = 15 * 60 * 1000;

const publicUser = (u) => ({ id: u._id, role: u.role, name: u.name, email: u.email, emailVerified: u.emailVerified, mobile: u.mobile, mobileVerified: u.mobileVerified, status: u.status, twoFactorEnabled: u.twoFactorEnabled, mustResetPassword: u.mustResetPassword });

async function sendEmailOtp(user) {
  return otp.create({ userId: user._id, target: user.email, purpose: 'email_verify', name: user.name });
}

async function registerEmployee({ name, email, mobile, password }, ip) {
  await duplicate.assertUniqueContact({ email, mobile, ip });
  const user = await User.create({ role: 'employee', name, email, mobile, passwordHash: await bcrypt.hash(password, 12), lastIp: ip });
  await EmployeeProfile.create({ userId: user._id, eibilId: eibilId(), fullName: name });
  const otpInfo = await sendEmailOtp(user);
  return { user: publicUser(user), otp: otpInfo };
}

async function registerEmployer({ companyName, cin, gstin, email, password, hrContactName, phone, industry, city }, ip) {
  const domain = email.split('@')[1].toLowerCase();
  if (FREE_EMAIL_DOMAINS.includes(domain)) throw AppError.badRequest('Please use your official work email. Free email domains are not allowed for employers');
  await duplicate.assertUniqueContact({ email, mobile: phone, ip });
  await duplicate.assertNotWatchlisted({ emailDomain: domain, ip });
  const user = await User.create({ role: 'employer', name: hrContactName, email, mobile: phone, passwordHash: await bcrypt.hash(password, 12), lastIp: ip });
  const check = await kyc[env.kycProvider === 'mock' ? 'mock' : env.kycProvider]({ gstin, cin });
  const employer = await Employer.create({ companyName, cin, gstin, domain, hrContactName, phone, industry, city, kycNotes: check.note, kycCheckedAt: new Date() });
  await EmployerUser.create({ employerId: employer._id, userId: user._id, role: 'Owner' });
  const otpInfo = await sendEmailOtp(user);
  return { user: publicUser(user), employer, otp: otpInfo };
}

async function verifyEmail({ email, code }) {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw AppError.notFound('Account not found');
  await otp.verify({ target: user.email, purpose: 'email_verify', code });
  user.emailVerified = true;
  await user.save();
  await queue.enqueue('email.send', { to: user.email, ...welcome({ name: user.name, role: user.role }) });
  return publicUser(user);
}

async function resendOtp({ email, purpose = 'email_verify' }) {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw AppError.notFound('Account not found');
  return otp.create({ userId: user._id, target: user.email, purpose, name: user.name });
}

async function issueTokens(user, meta = {}) {
  const jti = randomToken(16);
  await Session.create({ userId: user._id, jti, ip: meta.ip, userAgent: meta.userAgent, expiresAt: new Date(Date.now() + env.refreshTtlDays * 864e5) });
  user.lastLogin = new Date();
  user.lastIp = meta.ip;
  await user.save();
  return { accessToken: signAccess(user), refreshToken: signRefresh(user._id, jti), user: publicUser(user) };
}

async function login({ email, password, portal }, meta) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user) throw AppError.unauthorized('Invalid email or password');
  if (user.lockUntil && user.lockUntil > new Date()) throw AppError.tooMany('Account temporarily locked after failed attempts. Try again in 15 minutes');
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    user.failedLogins += 1;
    if (user.failedLogins >= MAX_FAILED) { user.lockUntil = new Date(Date.now() + LOCK_MS); user.failedLogins = 0; }
    await user.save();
    throw AppError.unauthorized('Invalid email or password');
  }
  if (portal && portal !== user.role) throw AppError.forbidden(`This account belongs to the ${user.role} portal`);
  if (user.status !== 'active') throw AppError.forbidden(`Account ${user.status}. Contact support`);
  user.failedLogins = 0;
  user.lockUntil = undefined;
  const needs2fa = (user.role === 'admin' && (await settings.get('adminTwoFactorRequired'))) || user.twoFactorEnabled;
  if (needs2fa) {
    await user.save();
    const info = await otp.create({ userId: user._id, target: user.email, purpose: 'login_2fa', name: user.name });
    return { twoFactorRequired: true, email: user.email, ...info };
  }
  return issueTokens(user, meta);
}

async function verify2fa({ email, code }, meta) {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw AppError.unauthorized();
  await otp.verify({ target: user.email, purpose: 'login_2fa', code });
  return issueTokens(user, meta);
}

async function refresh(token, meta) {
  if (!token) throw AppError.unauthorized('No refresh token');
  let payload;
  try { payload = verifyRefresh(token); } catch { throw AppError.unauthorized('Invalid refresh token'); }
  const session = await Session.findOne({ jti: payload.jti });
  if (!session) throw AppError.unauthorized('Session not found');
  if (session.revoked) {
    await Session.updateMany({ userId: session.userId }, { revoked: true });
    throw AppError.unauthorized('Refresh token reuse detected. All sessions revoked');
  }
  session.revoked = true;
  await session.save();
  const user = await User.findById(payload.sub);
  if (!user || user.status !== 'active') throw AppError.unauthorized();
  return issueTokens(user, meta);
}

async function logout(token) {
  try { const p = verifyRefresh(token); await Session.updateOne({ jti: p.jti }, { revoked: true }); } catch { /* already invalid */ }
}

async function me(user) {
  const base = publicUser(user);
  if (user.role === 'employee') base.profile = await EmployeeProfile.findOne({ userId: user._id }).lean();
  if (user.role === 'employer') {
    const eu = await EmployerUser.findOne({ userId: user._id }).lean();
    base.employerRole = eu?.role;
    base.employer = eu ? await Employer.findById(eu.employerId).populate('planId').lean() : null;
  }
  if (user.role === 'admin') base.adminRole = await Role.findById(user.adminRoleId).lean();
  return base;
}

async function forgotPassword({ email }) {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return {};
  return otp.create({ userId: user._id, target: user.email, purpose: 'password_reset', name: user.name });
}

async function resetPassword({ email, code, password }) {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw AppError.badRequest('Invalid request');
  await otp.verify({ target: user.email, purpose: 'password_reset', code });
  user.passwordHash = await bcrypt.hash(password, 12);
  user.mustResetPassword = false;
  await user.save();
  await Session.updateMany({ userId: user._id }, { revoked: true });
}

async function changePassword(userId, { currentPassword, password }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw AppError.badRequest('Current password is incorrect');
  user.passwordHash = await bcrypt.hash(password, 12);
  user.mustResetPassword = false;
  await user.save();
}

async function sendMobileOtp(user) {
  if (!user.mobile) throw AppError.badRequest('Add a mobile number first');
  return otp.create({ userId: user._id, target: user.mobile, purpose: 'mobile_verify', channel: 'sms' });
}

async function verifyMobile(user, code) {
  await otp.verify({ target: user.mobile, purpose: 'mobile_verify', code });
  await User.updateOne({ _id: user._id }, { mobileVerified: true });
}

const sessions = (userId) => Session.find({ userId, revoked: false, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).lean();
const revokeSessions = (userId) => Session.updateMany({ userId }, { revoked: true });
const toggle2fa = (userId, enabled) => User.updateOne({ _id: userId }, { twoFactorEnabled: enabled });

module.exports = {
  publicUser, registerEmployee, registerEmployer, verifyEmail, resendOtp, login, verify2fa, refresh, logout, me,
  forgotPassword, resetPassword, changePassword, sendMobileOtp, verifyMobile, sessions, revokeSessions, toggle2fa, issueTokens,
};
