const SeparationCase = require('../models/SeparationCase');
const ExitAssessment = require('../models/ExitAssessment');
const ExitRebuttal = require('../models/ExitRebuttal');
const EmployeeProfile = require('../models/EmployeeProfile');
const Dispute = require('../models/Dispute');
const AppError = require('../utils/AppError');
const ledger = require('./ledgerService');
const notify = require('./notificationService');
const score = require('./scoreService');
const scoreEvents = require('./scoreEventService');
const trust = require('./employerTrustService');

const BANNED = ['idiot', 'stupid', 'useless', 'fraudster', 'thief', 'liar', 'cheat', 'i think', 'probably', 'rumour', 'rumor', 'maybe', 'we suspect'];
const FIELDS = ['noticeRequiredDays', 'noticeServedDays', 'buyoutStatus', 'handoverStatus', 'assetsReturned', 'exitInterviewDone', 'settlementStatus', 'rehireEligibility', 'conductNotes', 'ratings', 'disciplinaryEvidence', 'comment'];

function moderate(text) {
  const t = String(text || '').toLowerCase();
  const hit = BANNED.find((w) => t.includes(w));
  if (hit) throw AppError.badRequest(`Comment rejected: keep it factual (remove "${hit}")`);
}

async function getEmployerCase(employer, caseId) {
  const sc = await SeparationCase.findOne({ _id: caseId, employerId: employer._id });
  if (!sc) throw AppError.notFound('Separation case not found');
  return sc;
}

async function saveDraft(employer, caseId, data) {
  const sc = await getEmployerCase(employer, caseId);
  if (!['notice_running', 'assessment_pending'].includes(sc.status)) throw AppError.badRequest('Assessment can only be edited before submission');
  moderate(data.comment);
  moderate(data.conductNotes);
  const picked = Object.fromEntries(FIELDS.filter((f) => data[f] !== undefined).map((f) => [f, data[f]]));
  if (data.separationType) sc.separationType = data.separationType;
  if (data.reasonCategory) sc.reasonCategory = data.reasonCategory;
  await sc.save();
  const a = await ExitAssessment.findOneAndUpdate({ separationCaseId: sc._id }, { ...picked, separationCaseId: sc._id }, { upsert: true, new: true });
  a.noticeShortfall = Math.max(0, (a.noticeRequiredDays || 0) - (a.noticeServedDays || 0));
  return a.save();
}

async function submit(employer, caseId) {
  const sc = await getEmployerCase(employer, caseId);
  const a = await ExitAssessment.findOne({ separationCaseId: sc._id });
  if (!a) throw AppError.badRequest('Save the assessment before submitting');
  if (['termination_misconduct', 'absconded'].includes(sc.separationType) && !a.disciplinaryEvidence?.length) throw AppError.badRequest('Misconduct/absconding cases require uploaded evidence (notice or inquiry report)');
  const cfg = await score.getActiveConfig();
  a.submittedAt = new Date();
  await a.save();
  sc.status = 'review_window';
  sc.reviewWindowEndsAt = new Date(Date.now() + cfg.events.reviewWindowDays * 864e5);
  await sc.save();
  await trust.record(employer._id, { exitAssessmentsDue: 1, ...(sc.assessmentDueAt && a.submittedAt <= sc.assessmentDueAt ? { exitAssessmentsOnTime: 1 } : {}) });
  await ledger.append({ entityType: 'exit_assessment', entityId: a._id, action: 'submitted', subjectId: sc.employeeId, payload: { caseId: sc._id, separationType: sc.separationType, noticeShortfall: a.noticeShortfall, rehireEligibility: a.rehireEligibility, handoverStatus: a.handoverStatus } });
  const p = await EmployeeProfile.findById(sc.employeeId).lean();
  if (p?.userId) await notify.notify(p.userId, { title: 'Exit assessment submitted', body: `Review it within ${cfg.events.reviewWindowDays} days: accept, attach a rebuttal or raise a dispute`, link: '/employee/exit', email: true });
  return sc;
}

async function employeeRespond(profile, caseId, { action, statement, attachments }) {
  const sc = await SeparationCase.findOne({ _id: caseId, employeeId: profile._id });
  if (!sc) throw AppError.notFound();
  if (!['review_window', 'admin_review', 'published'].includes(sc.status)) throw AppError.badRequest('No assessment to respond to yet');
  if (action === 'rebut') {
    if (!statement) throw AppError.badRequest('Rebuttal statement is required');
    await ExitRebuttal.create({ separationCaseId: sc._id, employeeId: profile._id, statement, attachments });
    sc.employeeResponse = 'rebutted';
  } else if (action === 'dispute') {
    await require('./disputeService').raise(profile, { _id: profile.userId }, { targetType: 'separation', targetId: sc._id, reason: statement || 'Exit assessment disputed', evidence: attachments });
    sc.employeeResponse = 'disputed';
  } else sc.employeeResponse = 'accepted';
  await sc.save();
  await ledger.append({ entityType: 'separation', entityId: sc._id, action: `employee_${sc.employeeResponse}`, subjectId: sc.employeeId, payload: { statement } });
  return sc;
}

async function publish(sc, { skipPenalty = false } = {}) {
  const a = await ExitAssessment.findOne({ separationCaseId: sc._id });
  const cfg = await score.getActiveConfig();
  const calc = score.exitDelta(a, sc.separationType, cfg);
  a.publishedAt = new Date();
  await a.save();
  sc.status = 'published';
  sc.publishedAt = a.publishedAt;
  const openDispute = await Dispute.exists({ targetType: 'separation', targetId: sc._id, status: { $in: ['open', 'under_review'] } });
  await ledger.append({ entityType: 'exit_assessment', entityId: a._id, action: 'published', subjectId: sc.employeeId, payload: { caseId: sc._id, separationType: sc.separationType, delta: calc.delta, reason: calc.reason, heldForDispute: Boolean(openDispute) } });
  if (!openDispute && !skipPenalty && calc.delta !== 0) {
    await scoreEvents.applyScoreEvent({ employeeId: sc.employeeId, delta: calc.delta, reason: `Exit assessment: ${calc.reason}`, source: 'exit', refType: 'separation', refId: sc._id, negative: calc.delta < 0, neverDecay: Boolean(calc.neverDecay), idempotencyKey: `exit:${sc._id}`, force: true });
    sc.scoreDelta = calc.delta;
  }
  return sc.save();
}

async function publishDue() {
  const due = await SeparationCase.find({ status: 'review_window', reviewWindowEndsAt: { $lte: new Date() } });
  let changes = 0;
  for (const sc of due) {
    if (['termination_misconduct', 'absconded'].includes(sc.separationType) && !sc.adminReviewed) { sc.status = 'admin_review'; await sc.save(); } else { await publish(sc); changes += 1; }
  }
  return { processed: due.length, changes };
}

async function adminReview(caseId, approve, note) {
  const sc = await SeparationCase.findById(caseId);
  if (!sc || !['admin_review', 'review_window'].includes(sc.status)) throw AppError.badRequest('Case is not awaiting admin review');
  sc.adminReviewed = true;
  sc.adminReviewNote = note;
  await sc.save();
  if (sc.status === 'admin_review') return publish(sc, { skipPenalty: !approve });
  return sc;
}

module.exports = { moderate, saveDraft, submit, employeeRespond, publish, publishDue, adminReview };
