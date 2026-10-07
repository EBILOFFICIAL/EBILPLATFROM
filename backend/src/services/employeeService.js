const EmployeeProfile = require('../models/EmployeeProfile');
const EmploymentRecord = require('../models/EmploymentRecord');
const Evaluation = require('../models/Evaluation');
const Offer = require('../models/Offer');
const Dispute = require('../models/Dispute');
const Consent = require('../models/Consent');
const Application = require('../models/Application');
const ScoreEvent = require('../models/ScoreEvent');
const AppError = require('../utils/AppError');
const score = require('./scoreService');
const reports = require('./reportService');

const EDITABLE = ['photo', 'location', 'headline', 'experienceYears', 'skills', 'education', 'resumeUrl'];

async function getProfile(userId) {
  const p = await EmployeeProfile.findOne({ userId });
  if (!p) throw AppError.notFound('Profile not found');
  return p;
}

async function updateProfile(userId, data) {
  const p = await getProfile(userId);
  EDITABLE.forEach((k) => { if (data[k] !== undefined) p[k] = data[k]; });
  if (data.fullName && !p.panVerified) p.fullName = data.fullName;
  return p.save();
}

async function scoreSummary(profile, user) {
  if (!user.emailVerified || !profile.panVerified) throw AppError.forbidden('Verify your email and PAN to view your EIBIL score');
  const cfg = await score.getActiveConfig();
  const evals = await Evaluation.find({ employeeId: profile._id, status: 'accepted' }).lean();
  const avg = (k) => (evals.length ? Math.round(evals.reduce((a, e) => a + e[k], 0) / evals.length) : null);
  const history = await ScoreEvent.find({ employeeId: profile._id }).sort({ createdAt: 1 }).lean();
  return {
    score: profile.currentScore, band: profile.band, asOf: profile.scoreUpdatedAt, paused: profile.scorePaused, frozen: profile.scoreFrozen,
    range: [cfg.min, cfg.max], bands: cfg.bands, baseline: cfg.baseline,
    dimensions: { performance: avg('performance'), professionalism: avg('professionalism'), reliability: avg('reliability'), conduct: avg('conduct') },
    trend: history.map((h) => ({ date: h.createdAt, score: h.newScore })),
  };
}

async function updatePrivacy(profile, { openToWork, showExactScore, hideFromEmployerIds, hideOfferStatusFromEmployerIds, allowCurrentEmployerOfferView }) {
  if (openToWork !== undefined) profile.openToWork = openToWork;
  const v = profile.visibility;
  if (showExactScore !== undefined) v.showExactScore = showExactScore;
  if (hideFromEmployerIds) v.hideFromEmployerIds = hideFromEmployerIds;
  if (hideOfferStatusFromEmployerIds) v.hideOfferStatusFromEmployerIds = hideOfferStatusFromEmployerIds;
  if (allowCurrentEmployerOfferView !== undefined) v.allowCurrentEmployerOfferView = allowCurrentEmployerOfferView;
  return profile.save();
}

async function exportData(profile, user) {
  const id = profile._id;
  const [employment, evaluations, offers, disputes, consents, applications, scoreEvents] = await Promise.all([
    EmploymentRecord.find({ employeeId: id }).select('+ctcPrivate').lean(), Evaluation.find({ employeeId: id }).lean(), Offer.find({ employeeId: id }).select('+ctcPrivate').lean(),
    Dispute.find({ employeeId: id }).lean(), Consent.find({ employeeId: id }).lean(), Application.find({ employeeId: id }).lean(), ScoreEvent.find({ employeeId: id }).lean(),
  ]);
  return { exportedAt: new Date(), account: { name: user.name, email: user.email, mobile: user.mobile }, profile: { ...profile.toObject(), panEncrypted: undefined, panHash: undefined }, employment, evaluations, offers, disputes, consents, applications, scoreEvents, reportViews: await reports.viewers(id) };
}

async function requestDeletion(profile) {
  profile.deletionRequestedAt = new Date();
  profile.openToWork = false;
  return profile.save();
}

const timeline = (profileId) => EmploymentRecord.find({ employeeId: profileId }).populate('employerId', 'companyName').sort({ startDate: -1 }).lean();
const evaluations = (profileId) => Evaluation.find({ employeeId: profileId, status: { $ne: 'draft' } }).populate('employerId', 'companyName').sort({ createdAt: -1 }).lean();

module.exports = { getProfile, updateProfile, scoreSummary, updatePrivacy, exportData, requestDeletion, timeline, evaluations };
