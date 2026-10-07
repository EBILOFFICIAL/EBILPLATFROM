const Dispute = require('../models/Dispute');
const Evaluation = require('../models/Evaluation');
const EmploymentRecord = require('../models/EmploymentRecord');
const Offer = require('../models/Offer');
const SeparationCase = require('../models/SeparationCase');
const ScoreEvent = require('../models/ScoreEvent');
const EmployeeProfile = require('../models/EmployeeProfile');
const AppError = require('../utils/AppError');
const ledger = require('./ledgerService');
const score = require('./scoreService');
const scoreEvents = require('./scoreEventService');
const notify = require('./notificationService');

const MODELS = { evaluation: Evaluation, employment: EmploymentRecord, offer: Offer, separation: SeparationCase, score_event: ScoreEvent };

async function raise(profile, user, { targetType, targetId, reason, evidence = [] }) {
  const Model = MODELS[targetType];
  if (!Model) throw AppError.badRequest('Invalid dispute target');
  const target = await Model.findOne({ _id: targetId, employeeId: profile._id });
  if (!target) throw AppError.notFound('Record not found on your profile');
  if (await Dispute.exists({ targetType, targetId, status: { $in: ['open', 'under_review'] } })) throw AppError.conflict('A dispute is already open for this record');
  const dispute = await Dispute.create({ targetType, targetId, employeeId: profile._id, employerId: target.employerId, raisedBy: user._id, reason, evidence, slaDueAt: new Date(Date.now() + 15 * 864e5) });
  const cfg = await score.getActiveConfig();
  if (targetType === 'evaluation') {
    if (target.status === 'accepted' && target.appliedDelta && cfg.events.disputeHoldsScore) {
      await scoreEvents.applyScoreEvent({ employeeId: profile._id, delta: -target.appliedDelta, reason: `Evaluation ${target.period} held out of score pending dispute`, source: 'dispute', refType: 'dispute', refId: dispute._id, idempotencyKey: `dispute-hold:${dispute._id}`, force: true });
      dispute.heldDelta = target.appliedDelta;
      await dispute.save();
    }
    target.status = 'disputed';
    await target.save();
  }
  if (targetType === 'employment') { target.status = 'disputed'; await target.save(); }
  await ledger.append({ entityType: 'dispute', entityId: dispute._id, action: 'raised', subjectId: profile._id, payload: { targetType, targetId, reason } });
  if (target.employerId) await notify.notifyEmployer(target.employerId, { title: 'Dispute raised', body: `An employee disputed a ${targetType} record`, link: '/employer' });
  return dispute;
}

async function resolve(disputeId, admin, { outcome, resolution, ratings, corrections }) {
  const d = await Dispute.findById(disputeId);
  if (!d || !['open', 'under_review'].includes(d.status)) throw AppError.badRequest('Dispute is not open');
  if (!resolution) throw AppError.badRequest('A written resolution is required');
  const target = await MODELS[d.targetType].findById(d.targetId);
  const cfg = await score.getActiveConfig();
  const apply = (delta, reason, key) => scoreEvents.applyScoreEvent({ employeeId: d.employeeId, delta, reason, source: 'dispute', refType: 'dispute', refId: d._id, idempotencyKey: `${key}:${d._id}`, force: true });

  if (d.targetType === 'evaluation') {
    if (outcome === 'employee') {
      if (!d.heldDelta && target.appliedDelta) await apply(-target.appliedDelta, `Dispute upheld: evaluation ${target.period} removed`, 'dispute-reverse');
      target.status = 'removed';
    } else if (outcome === 'modify') {
      Object.assign(target, ratings || {});
      const calc = score.evaluationDelta(target, cfg, {});
      target.composite = calc.composite;
      const base = d.heldDelta ? 0 : target.appliedDelta;
      await apply(calc.delta - base, `Dispute resolved: evaluation ${target.period} modified`, 'dispute-modify');
      target.appliedDelta = calc.delta;
      target.status = 'accepted';
    } else {
      if (d.heldDelta) await apply(d.heldDelta, `Dispute rejected: evaluation ${target.period} reinstated`, 'dispute-reinstate');
      target.status = 'accepted';
    }
    await target.save();
  }
  if (d.targetType === 'employment') {
    if (outcome !== 'employer' && corrections) Object.assign(target, corrections);
    target.status = 'verified';
    await target.save();
  }
  if (d.targetType === 'separation' && target.status === 'published') {
    const ev = await ScoreEvent.findOne({ idempotencyKey: `exit:${target._id}` });
    if (outcome === 'employee' && ev) await apply(-ev.delta, 'Dispute upheld: exit penalty reversed', 'dispute-exit-reverse');
    if (outcome !== 'employee' && !ev) {
      const a = await require('../models/ExitAssessment').findOne({ separationCaseId: target._id });
      const calc = score.exitDelta(a, target.separationType, cfg);
      if (calc.delta) await scoreEvents.applyScoreEvent({ employeeId: d.employeeId, delta: calc.delta, reason: `Exit assessment: ${calc.reason}`, source: 'exit', refType: 'separation', refId: target._id, idempotencyKey: `exit:${target._id}`, force: true });
    }
  }
  if (d.targetType === 'offer' && outcome === 'employee') {
    const ev = await ScoreEvent.findOne({ idempotencyKey: `noshow:${target._id}` });
    if (ev) await apply(-ev.delta, 'Dispute upheld: no-show penalty reversed', 'dispute-noshow-reverse');
    target.noShowPenaltyApplied = true;
    await target.save();
  }
  if (d.targetType === 'score_event' && outcome === 'employee') await apply(-target.delta, `Dispute upheld: score change reversed (${target.reason})`, 'dispute-se-reverse');

  d.status = { employee: 'resolved_employee', employer: 'resolved_employer', modify: 'modified' }[outcome] || 'rejected';
  Object.assign(d, { resolution, resolvedBy: admin._id, resolvedAt: new Date() });
  await d.save();
  await ledger.append({ entityType: 'dispute', entityId: d._id, action: 'resolved', subjectId: d.employeeId, payload: { outcome, resolution } });
  const p = await EmployeeProfile.findById(d.employeeId).lean();
  if (p?.userId) await notify.notify(p.userId, { title: 'Dispute resolved', body: resolution, link: '/employee/disputes', email: true });
  return d;
}

module.exports = { raise, resolve };
