const EmployeeProfile = require('../models/EmployeeProfile');
const Consent = require('../models/Consent');
const AppError = require('../utils/AppError');
const env = require('../config/env');
const { encrypt } = require('../utils/crypto');
const { normalizePan, isValidPan, isIndividualPan, maskPan, hashPan } = require('../utils/panUtils');
const { nameSimilarity } = require('../utils/stringMatch');
const providers = require('./providers/panProviders');
const settings = require('./settingsService');
const fraud = require('./fraudService');
const duplicate = require('./duplicateService');
const audit = require('./auditService');
const scoreEvents = require('./scoreEventService');

const provider = () => providers[env.panProvider] || providers.mock;

async function claimShellIfAny(profile, panHash) {
  const shell = await EmployeeProfile.findOne({ panHash, isShell: true, userId: null });
  if (!shell) return profile;
  shell.userId = profile.userId;
  shell.fullName = profile.fullName;
  shell.isShell = false;
  shell.claimedAt = new Date();
  shell.panHash = undefined;
  await shell.save();
  await EmployeeProfile.deleteOne({ _id: profile._id });
  return shell;
}

async function assertDailyBudget() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const used = await Consent.countDocuments({ type: 'pan_verification', createdAt: { $gte: start } });
  if (used >= await settings.get('panDailyLimit')) throw AppError.tooMany('Daily PAN verification capacity reached. Try again tomorrow');
}

async function verifyPan(user, { pan: rawPan, name, dob, consent }, req) {
  let profile = await EmployeeProfile.findOne({ userId: user._id });
  if (!profile) throw AppError.notFound('Profile not found');
  if (profile.panVerified) throw AppError.conflict('PAN already verified for this profile');
  if (profile.panLockedUntil && profile.panLockedUntil > new Date()) throw AppError.tooMany('PAN verification locked after repeated failures. Try again later');
  if (!consent) throw AppError.badRequest('Explicit consent is required for PAN verification');
  const pan = normalizePan(rawPan);
  if (!isValidPan(pan)) throw AppError.badRequest('Invalid PAN format (expected ABCDE1234F)');
  if (!isIndividualPan(pan)) throw AppError.badRequest('Only individual PANs (4th character P) are allowed');
  await assertDailyBudget();
  const panHash = hashPan(pan);
  await duplicate.assertNotWatchlisted({ panHash, ip: req.ip });
  await Consent.create({ employeeId: profile._id, type: 'pan_verification', purpose: 'PAN identity verification', mode: 'self', status: 'granted', consentTextVersion: await settings.get('consentTextVersion'), ip: req.ip, respondedAt: new Date() });

  profile.panAttempts += 1;
  const max = await settings.get('panMaxAttempts');
  if (profile.panAttempts > max) {
    profile.panLockedUntil = new Date(Date.now() + 3600e3);
    profile.panAttempts = 0;
    await profile.save();
    throw AppError.tooMany('Too many PAN attempts. Locked for 1 hour');
  }
  await profile.save();

  const existing = await EmployeeProfile.findOne({ panHash, _id: { $ne: profile._id } }).lean();
  if (existing && !(existing.isShell && !existing.userId)) {
    await fraud.flag({ type: 'duplicate_pan', severity: 'high', employeeId: profile._id, userId: user._id, ip: req.ip, details: { existingEibilId: existing.eibilId, panMasked: maskPan(pan) } });
    await audit.log({ req, action: 'pan.duplicate_blocked', entityType: 'EmployeeProfile', entityId: profile._id });
    throw AppError.conflict('This PAN is already linked to an existing EIBIL profile. Please use account recovery or contact support');
  }

  const result = await provider()({ pan, name, dob });
  if (!result.valid) {
    profile.panStatus = 'rejected';
    await profile.save();
    throw AppError.badRequest('PAN could not be verified with the issuing authority');
  }

  if (existing) profile = await claimShellIfAny(profile, panHash);
  const similarity = nameSimilarity(name, result.nameOnPan);
  const threshold = await settings.get('nameMatchThreshold');
  Object.assign(profile, {
    panEncrypted: encrypt(pan), panHash, panMasked: maskPan(pan), panProviderRef: result.ref, panProviderName: result.nameOnPan,
    panNameScore: Math.round(similarity * 100) / 100, dob: dob ? new Date(dob) : profile.dob, fullName: name || profile.fullName,
  });
  const autoApprove = similarity >= threshold && result.dobMatch;
  profile.panStatus = autoApprove ? 'verified' : 'pending_review';
  profile.panVerified = autoApprove;
  profile.panVerifiedAt = autoApprove ? new Date() : undefined;
  profile.panAttempts = 0;
  try { await profile.save(); } catch (err) {
    if (err.code === 11000) throw AppError.conflict('This PAN is already linked to an existing EIBIL profile');
    throw err;
  }
  const near = await duplicate.findNearDuplicates(profile);
  if (near.length) await fraud.flag({ type: 'near_duplicate', severity: 'medium', employeeId: profile._id, details: { matches: near.map((n) => n.eibilId) } });
  if (autoApprove) await scoreEvents.initBaseline(profile._id);
  await audit.log({ req, action: autoApprove ? 'pan.verified' : 'pan.queued_for_review', entityType: 'EmployeeProfile', entityId: profile._id, meta: { similarity: profile.panNameScore } });
  return { panStatus: profile.panStatus, panMasked: profile.panMasked, nameMatch: profile.panNameScore };
}

async function adminDecision(profileId, approve, reason, req) {
  const profile = await EmployeeProfile.findById(profileId);
  if (!profile) throw AppError.notFound();
  const before = { panStatus: profile.panStatus };
  profile.panStatus = approve ? 'verified' : 'rejected';
  profile.panVerified = approve;
  profile.panVerifiedAt = approve ? new Date() : undefined;
  if (!approve) { profile.panHash = undefined; profile.panEncrypted = undefined; profile.panMasked = undefined; }
  await profile.save();
  if (approve) await scoreEvents.initBaseline(profile._id);
  await audit.log({ req, action: approve ? 'pan.admin_approved' : 'pan.admin_rejected', entityType: 'EmployeeProfile', entityId: profileId, before, after: { panStatus: profile.panStatus }, meta: { reason } });
  return profile;
}

async function resetVerification(profileId, req) {
  const profile = await EmployeeProfile.findById(profileId);
  Object.assign(profile, { panStatus: 'not_submitted', panVerified: false, panHash: undefined, panEncrypted: undefined, panMasked: undefined, panAttempts: 0, panLockedUntil: undefined });
  await profile.save();
  await audit.log({ req, action: 'pan.reset', entityType: 'EmployeeProfile', entityId: profileId });
  return profile;
}

module.exports = { verifyPan, adminDecision, resetVerification, provider };
