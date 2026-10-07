const Offer = require('../models/Offer');
const EmploymentRecord = require('../models/EmploymentRecord');
const Dispute = require('../models/Dispute');
const Employer = require('../models/Employer');
const AppError = require('../utils/AppError');
const { randomToken } = require('../utils/crypto');
const ledger = require('./ledgerService');
const otp = require('./otpService');
const notify = require('./notificationService');
const consent = require('./consentService');
const trust = require('./employerTrustService');
const fraud = require('./fraudService');
const employment = require('./employmentService');
const score = require('./scoreService');
const scoreEvents = require('./scoreEventService');
const upload = require('./uploadService');

async function transition(offer, status, by, note) {
  offer.status = status;
  offer.stateHistory.push({ status, by, at: new Date(), note });
  await offer.save();
  await ledger.append({ entityType: 'offer', entityId: offer._id, action: status, subjectId: offer.employeeId, payload: { status, employerId: offer.employerId, designation: offer.designation, expectedJoiningDate: offer.expectedJoiningDate, note } });
  return offer;
}

async function issue(employer, user, data, file) {
  if (employer.kycStatus !== 'approved') throw AppError.forbidden('Employer must be approved before issuing offers');
  const profile = await consent.findCandidate(data.candidate);
  if (!profile || !profile.userId) throw AppError.notFound('Candidate profile not found');
  const doc = file ? await upload.save(file, { ownerId: user._id, purpose: 'offer_letter' }) : null;
  const offer = new Offer({
    employeeId: profile._id, employerId: employer._id, companyName: employer.companyName, designation: data.designation, department: data.department, location: data.location,
    offerDate: data.offerDate || new Date(), validUntil: data.validUntil, expectedJoiningDate: data.expectedJoiningDate,
    documentFileId: doc?._id, documentHash: doc?.sha256, source: 'employer', verified: true, stateHistory: [],
  });
  await transition(offer, 'issued', user._id);
  await trust.record(employer._id, { offersIssued: 1 });
  await notify.notify(profile.userId, { title: `Offer from ${employer.companyName}`, body: `${data.designation}. Review and e-accept in your Career Hub`, link: '/employee/offers', email: true });
  return offer;
}

async function selfDeclare(profile, user, data) {
  const employer = data.employerId ? await Employer.findById(data.employerId).lean() : null;
  const offer = new Offer({ ...data, employeeId: profile._id, employerId: employer?._id, companyName: employer?.companyName || data.companyName, source: 'self_declared', verified: false, confirmToken: randomToken(16), ctcPrivate: data.ctc, stateHistory: [] });
  await transition(offer, data.accepted ? 'accepted' : 'issued', user._id, 'Self-declared (unverified)');
  return offer;
}

async function confirmByToken(token) {
  const offer = await Offer.findOne({ confirmToken: token, verified: false });
  if (!offer) throw AppError.notFound('Invalid confirmation link');
  offer.verified = true;
  offer.confirmToken = undefined;
  return transition(offer, offer.status, null, 'Confirmed by issuing company via secure link');
}

async function getOwn(profile, id) {
  const offer = await Offer.findOne({ _id: id, employeeId: profile._id });
  if (!offer) throw AppError.notFound('Offer not found');
  return offer;
}

async function requestAcceptOtp(profile, user, id) {
  const offer = await getOwn(profile, id);
  if (offer.status !== 'issued') throw AppError.badRequest('Offer is not open for acceptance');
  return otp.create({ userId: user._id, target: user.email, purpose: 'offer_accept', name: user.name, meta: { offerId: offer._id } });
}

async function accept(profile, user, id, code) {
  if (!user.emailVerified || !profile.panVerified) throw AppError.forbidden('Email and PAN verification are required to accept offers');
  const offer = await getOwn(profile, id);
  if (offer.status !== 'issued') throw AppError.badRequest('Offer is not open for acceptance');
  if (offer.validUntil && offer.validUntil < new Date()) throw AppError.badRequest('Offer validity has expired');
  await otp.verify({ target: user.email, purpose: 'offer_accept', code });
  const j = offer.expectedJoiningDate ? new Date(offer.expectedJoiningDate) : new Date();
  const overlap = await Offer.findOne({ _id: { $ne: offer._id }, employeeId: profile._id, status: 'accepted', expectedJoiningDate: { $gte: new Date(j - 30 * 864e5), $lte: new Date(+j + 30 * 864e5) } }).lean();
  if (overlap) {
    offer.overlapFlag = true;
    await fraud.flag({ type: 'offer_overlap', severity: 'medium', employeeId: profile._id, details: { offerA: overlap._id, offerB: offer._id } });
  }
  await transition(offer, 'accepted', user._id, 'E-accepted with OTP');
  if (offer.employerId) await notify.notifyEmployer(offer.employerId, { title: 'Offer accepted', body: `${profile.fullName} accepted the ${offer.designation} offer`, link: '/employer/offers' });
  return offer;
}

async function decline(profile, user, id) {
  const offer = await getOwn(profile, id);
  if (offer.status !== 'issued') throw AppError.badRequest('Only open offers can be declined');
  return transition(offer, 'declined', user._id);
}

async function getEmployerOffer(employer, id) {
  const offer = await Offer.findOne({ _id: id, employerId: employer._id });
  if (!offer) throw AppError.notFound('Offer not found');
  return offer;
}

async function confirmJoin(employer, user, id) {
  const offer = await getEmployerOffer(employer, id);
  if (offer.status !== 'accepted') throw AppError.badRequest('Only accepted offers can be marked as joined');
  const record = await EmploymentRecord.create({ employeeId: offer.employeeId, employerId: employer._id, companyName: employer.companyName, designation: offer.designation, department: offer.department, startDate: offer.expectedJoiningDate || new Date(), isCurrent: true, source: 'offer' });
  await employment.seal(record, user, 'verified_from_offer');
  offer.confirmedBy = user._id;
  return transition(offer, 'joined', user._id, `Employment record ${record._id} created`);
}

async function markNoShow(employer, user, id) {
  const offer = await getEmployerOffer(employer, id);
  if (offer.status !== 'accepted') throw AppError.badRequest('Only accepted offers can be marked as no-show');
  const cfg = await score.getActiveConfig();
  offer.noShowDisputeEndsAt = new Date(Date.now() + cfg.events.noShowDisputeWindowDays * 864e5);
  await transition(offer, 'no_show', user._id, 'Employer confirmed candidate did not join');
  const p = await require('../models/EmployeeProfile').findById(offer.employeeId).lean();
  if (p?.userId) await notify.notify(p.userId, { title: 'Offer marked as no-show', body: `You can dispute this within ${cfg.events.noShowDisputeWindowDays} days before it affects your score`, link: '/employee/offers', email: true });
  return offer;
}

async function withdraw(employer, user, id, reason) {
  if (!reason) throw AppError.badRequest('Withdrawal reason is mandatory');
  const offer = await getEmployerOffer(employer, id);
  if (!['issued', 'accepted'].includes(offer.status)) throw AppError.badRequest('Offer cannot be withdrawn in its current state');
  const wasAccepted = offer.status === 'accepted';
  offer.withdrawalReason = reason;
  await transition(offer, 'withdrawn', user._id, reason);
  await trust.record(employer._id, { offersWithdrawn: 1, ...(wasAccepted ? { acceptedWithdrawn: 1 } : {}) });
  return offer;
}

async function processNoShows() {
  const cfg = await score.getActiveConfig();
  const due = await Offer.find({ status: 'no_show', noShowPenaltyApplied: false, noShowDisputeEndsAt: { $lt: new Date() } });
  let changes = 0;
  for (const offer of due) {
    const open = await Dispute.exists({ targetType: 'offer', targetId: offer._id, status: { $in: ['open', 'under_review'] } });
    const upheld = await Dispute.exists({ targetType: 'offer', targetId: offer._id, status: 'resolved_employee' });
    if (open) continue;
    if (!upheld) {
      await scoreEvents.applyScoreEvent({ employeeId: offer.employeeId, delta: -cfg.events.noShowPenalty, reason: `Accepted offer from ${offer.companyName} but did not join (employer confirmed)`, source: 'offer', refType: 'offer', refId: offer._id, idempotencyKey: `noshow:${offer._id}`, force: true }).catch(() => null);
      changes += 1;
    }
    offer.noShowPenaltyApplied = true;
    await offer.save();
  }
  return { processed: due.length, changes };
}

async function expireOffers() {
  const due = await Offer.find({ status: 'issued', validUntil: { $lt: new Date() } });
  for (const o of due) await transition(o, 'expired', null, 'Validity passed');
  return { processed: due.length, changes: due.length };
}

async function offerStatusForEmployer(employer, employeeId) {
  if (!(await consent.activeConsent(employer._id, employeeId))) throw AppError.forbidden('Candidate consent required');
  const report = await require('./reportService').build(employeeId, { employerId: employer._id });
  return report.offers;
}

module.exports = { issue, selfDeclare, confirmByToken, requestAcceptOtp, accept, decline, confirmJoin, markNoShow, withdraw, processNoShows, expireOffers, offerStatusForEmployer, getEmployerOffer };
