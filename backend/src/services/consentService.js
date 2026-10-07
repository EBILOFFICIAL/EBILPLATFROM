const Consent = require('../models/Consent');
const EmployeeProfile = require('../models/EmployeeProfile');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const queue = require('../config/queue');
const { normalizePan, isValidPan, hashPan } = require('../utils/panUtils');
const otp = require('./otpService');
const notify = require('./notificationService');
const settings = require('./settingsService');
const consentTpl = require('../templates/email/consentRequest');

async function findCandidate(query) {
  const q = String(query || '').trim();
  const pan = normalizePan(q);
  if (isValidPan(pan)) return EmployeeProfile.findOne({ panHash: hashPan(pan) });
  if (q.toUpperCase().startsWith('EIB-')) return EmployeeProfile.findOne({ eibilId: q.toUpperCase() });
  if (q.includes('@')) {
    const user = await User.findOne({ email: q.toLowerCase(), role: 'employee' }).lean();
    return user ? EmployeeProfile.findOne({ userId: user._id }) : null;
  }
  return null;
}

const activeConsent = (employerId, employeeId) => Consent.findOne({ requesterEmployerId: employerId, employeeId, type: 'report_access', status: 'granted', expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });

const expiry = async () => new Date(Date.now() + (await settings.get('consentValidityDays')) * 864e5);

async function request(employer, { query, purpose, mode = 'on_demand' }, ip) {
  const profile = await findCandidate(query);
  if (!profile || !profile.userId) throw AppError.notFound('No claimed EIBIL profile found for this PAN / email / EIBIL ID');
  const existing = await activeConsent(employer._id, profile._id);
  if (existing) return { consent: existing, alreadyGranted: true, eibilId: profile.eibilId };
  const consent = await Consent.create({ employeeId: profile._id, requesterEmployerId: employer._id, purpose: purpose || 'Pre-employment verification', mode, ip, consentTextVersion: await settings.get('consentTextVersion') });
  const user = await User.findById(profile.userId).lean();
  let devOtp;
  if (mode === 'otp') {
    const info = await otp.create({ userId: user._id, target: user.email, purpose: 'consent', meta: { consentId: consent._id } });
    consent.otpTokenId = info.otpId;
    await consent.save();
    devOtp = info.devOtp;
  }
  await notify.notify(user._id, { title: 'Report access request', body: `${employer.companyName} requested consent to view your EIBIL report`, link: '/employee/consents' });
  if (mode !== 'otp') await queue.enqueue('email.send', { to: user.email, ...consentTpl({ name: user.name, company: employer.companyName }) });
  return { consent, alreadyGranted: false, eibilId: profile.eibilId, ...(devOtp ? { devOtp } : {}) };
}

async function grant(consent) {
  consent.status = 'granted';
  consent.respondedAt = new Date();
  consent.expiresAt = await expiry();
  return consent.save();
}

async function verifyOtp(employer, consentId, code) {
  const consent = await Consent.findOne({ _id: consentId, requesterEmployerId: employer._id, status: 'pending' });
  if (!consent) throw AppError.notFound('Pending consent not found');
  await otp.verify({ otpId: consent.otpTokenId, purpose: 'consent', code });
  return grant(consent);
}

async function respond(profile, consentId, approve) {
  const consent = await Consent.findOne({ _id: consentId, employeeId: profile._id, status: 'pending' });
  if (!consent) throw AppError.notFound('Pending consent not found');
  if (!approve) { consent.status = 'denied'; consent.respondedAt = new Date(); return consent.save(); }
  return grant(consent);
}

async function revoke(profile, consentId) {
  const consent = await Consent.findOne({ _id: consentId, employeeId: profile._id, status: 'granted' });
  if (!consent) throw AppError.notFound();
  consent.status = 'revoked';
  return consent.save();
}

async function grantFromApplication(employeeId, employerId) {
  const mode = await settings.get('consentMode');
  if (!['job_application', 'both'].includes(mode)) return null;
  const existing = await activeConsent(employerId, employeeId);
  if (existing) return existing;
  return Consent.create({ employeeId, requesterEmployerId: employerId, purpose: 'Job application', mode: 'job_application', status: 'granted', respondedAt: new Date(), expiresAt: await expiry(), consentTextVersion: await settings.get('consentTextVersion') });
}

const listForEmployee = (profileId) => Consent.find({ employeeId: profileId }).populate('requesterEmployerId', 'companyName').sort({ createdAt: -1 }).lean();
const listForEmployer = (employerId) => Consent.find({ requesterEmployerId: employerId, type: 'report_access' }).populate('employeeId', 'fullName eibilId').sort({ createdAt: -1 }).lean();

module.exports = { findCandidate, activeConsent, request, verifyOtp, respond, revoke, grantFromApplication, listForEmployee, listForEmployer };
