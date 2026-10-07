const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');
const { Watchlist } = require('../models/misc');
const AppError = require('../utils/AppError');
const fraud = require('./fraudService');

async function assertUniqueContact({ email, mobile, ip }) {
  const e = email.toLowerCase();
  if (await User.exists({ email: e })) {
    await fraud.flag({ type: 'duplicate_email', severity: 'low', details: { email: e }, ip });
    throw AppError.conflict('An account with this email already exists. Use login or account recovery');
  }
  if (mobile && await User.exists({ mobile })) {
    await fraud.flag({ type: 'duplicate_mobile', severity: 'low', details: { mobile: `${mobile.slice(0, 4)}******` }, ip });
    throw AppError.conflict('This mobile number is already registered');
  }
}

async function assertNotWatchlisted({ emailDomain, ip, panHash }) {
  const or = [];
  if (emailDomain) or.push({ type: 'email_domain', value: emailDomain });
  if (ip) or.push({ type: 'ip', value: ip });
  if (panHash) or.push({ type: 'pan', value: panHash });
  if (!or.length) return;
  const hit = await Watchlist.findOne({ $or: or }).lean();
  if (hit) {
    await fraud.flag({ type: 'watchlist_hit', severity: 'high', details: { type: hit.type, reason: hit.reason }, ip });
    throw AppError.forbidden('This registration cannot be processed. Contact support');
  }
}

async function findNearDuplicates(profile) {
  if (!profile.dob) return [];
  return EmployeeProfile.find({
    _id: { $ne: profile._id },
    fullName: new RegExp(`^${profile.fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    dob: profile.dob,
    panHash: { $exists: true, $ne: profile.panHash },
  }).select('eibilId panMasked').lean();
}

module.exports = { assertUniqueContact, assertNotWatchlisted, findNearDuplicates };
