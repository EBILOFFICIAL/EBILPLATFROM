const Evaluation = require('../models/Evaluation');
const EmploymentRecord = require('../models/EmploymentRecord');
const Employer = require('../models/Employer');
const EmployerUser = require('../models/EmployerUser');
const AppError = require('../utils/AppError');
const queue = require('../config/queue');
const score = require('./scoreService');
const scoreEvents = require('./scoreEventService');
const ledger = require('./ledgerService');
const fraud = require('./fraudService');
const settings = require('./settingsService');
const questionnaire = require('./questionnaireService');

async function ratingsFrom(data, cfg, requireAll) {
  if (!data.answers) return { dims: Object.fromEntries(DIMS.filter((d) => data[d] !== undefined).map((d) => [d, data[d]])) };
  return questionnaire.scoreAnswers(data.answers, { requireAll, fallback: cfg.neutralComposite });
}

const DIMS = ['performance', 'professionalism', 'reliability', 'conduct'];

function currentPeriod(cycle, date = new Date()) {
  const y = date.getFullYear();
  return cycle === 'half_yearly' ? `${y}-H${date.getMonth() < 6 ? 1 : 2}` : `${y}-Q${Math.floor(date.getMonth() / 3) + 1}`;
}

async function assertCanRate(employer, user, record, cfg) {
  if (employer.kycStatus !== 'approved') throw AppError.forbidden('Employer must be approved by EIBIL before submitting evaluations');
  const eu = await EmployerUser.findOne({ userId: user._id }).lean();
  if (!(await settings.get('allowedRaters')).includes(eu?.role)) throw AppError.forbidden('Your team role is not allowed to submit evaluations');
  if (!record || String(record.employerId) !== String(employer._id)) throw AppError.notFound('Employment record not found');
  if (record.status !== 'verified') throw AppError.badRequest('Only verified employment can be evaluated');
  const tenureDays = (Date.now() - new Date(record.startDate).getTime()) / 864e5;
  if (tenureDays < cfg.events.minTenureDaysToRate) throw AppError.badRequest(`Minimum tenure of ${cfg.events.minTenureDaysToRate} days required before rating`);
}

async function create(employer, user, data) {
  const cfg = await score.getActiveConfig();
  const record = await EmploymentRecord.findById(data.employmentRecordId);
  await assertCanRate(employer, user, record, cfg);
  const period = data.period || currentPeriod(await settings.get('evaluationCycle'));
  if (await Evaluation.exists({ employeeId: record.employeeId, employerId: employer._id, period })) throw AppError.conflict(`An evaluation already exists for ${period}`);
  const { dims, answers } = await ratingsFrom(data, cfg, Boolean(data.submit));
  if (DIMS.some((d) => dims[d] === undefined)) throw AppError.badRequest('All four dimension ratings are required');
  const ev = await Evaluation.create({
    employmentRecordId: record._id, employerId: employer._id, employeeId: record.employeeId, raterUserId: user._id, period,
    ...dims, answers, comments: data.comments,
    composite: score.composite(dims, cfg.weights), status: data.submit ? 'submitted' : 'draft', submittedAt: data.submit ? new Date() : undefined,
  });
  if (data.submit) await queue.enqueue('score.evaluation', { evaluationId: ev._id });
  return ev;
}

async function update(employer, id, data) {
  const ev = await Evaluation.findOne({ _id: id, employerId: employer._id });
  if (!ev) throw AppError.notFound();
  if (ev.status !== 'draft') throw AppError.forbidden('Submitted evaluations cannot be edited');
  const cfg = await score.getActiveConfig();
  const { dims, answers } = await ratingsFrom(data, cfg, Boolean(data.submit));
  DIMS.forEach((d) => { if (dims[d] !== undefined) ev[d] = dims[d]; });
  if (answers) ev.answers = answers;
  if (data.comments !== undefined) ev.comments = data.comments;
  ev.composite = score.composite(ev, cfg.weights);
  if (data.submit) { ev.status = 'submitted'; ev.submittedAt = new Date(); }
  await ev.save();
  if (data.submit) await queue.enqueue('score.evaluation', { evaluationId: ev._id });
  return ev;
}

async function accept(ev, cfg) {
  const employer = await Employer.findById(ev.employerId).lean();
  const ageMonths = (Date.now() - new Date(ev.submittedAt || ev.createdAt).getTime()) / (30 * 864e5);
  const calc = score.evaluationDelta(ev, cfg, { trustTier: employer.trustTier, ageMonths });
  ev.weight = calc.weight;
  ev.status = 'accepted';
  ev.appliedDelta = calc.delta;
  await ev.save();
  await ledger.append({ entityType: 'evaluation', entityId: ev._id, action: 'accepted', subjectId: ev.employeeId, payload: { period: ev.period, employerId: ev.employerId, ...Object.fromEntries(DIMS.map((d) => [d, ev[d]])), composite: calc.composite, weight: calc.weight, delta: calc.delta } });
  await scoreEvents.applyScoreEvent({ employeeId: ev.employeeId, delta: calc.delta, reason: `Quarterly evaluation ${ev.period} by ${employer.companyName} (composite ${calc.composite})`, source: 'evaluation', refType: 'evaluation', refId: ev._id, evaluationId: ev._id, idempotencyKey: `eval:${ev._id}` });
  return ev;
}

async function processSubmitted({ evaluationId }) {
  const ev = await Evaluation.findById(evaluationId);
  if (!ev || ev.status !== 'submitted') return null;
  const cfg = await score.getActiveConfig();
  const employer = await Employer.findById(ev.employerId).lean();
  if (employer.trustTier === 'flagged' || employer.status !== 'active') {
    ev.status = 'held'; ev.holdReason = 'Employer flagged: held for admin review';
    return ev.save();
  }
  if (await fraud.ratingOutlier(ev.employerId, ev.composite, cfg.events.outlierStdDev)) {
    ev.status = 'held'; ev.holdReason = 'Rating outlier: held for admin review';
    await fraud.flag({ type: 'rating_outlier', severity: 'medium', employerId: ev.employerId, employeeId: ev.employeeId, details: { evaluationId: ev._id, composite: ev.composite } });
    return ev.save();
  }
  return accept(ev, cfg);
}

async function release(id) {
  const ev = await Evaluation.findById(id);
  if (!ev || ev.status !== 'held') throw AppError.badRequest('Only held evaluations can be released');
  return accept(ev, await score.getActiveConfig());
}

async function remove(id, reason) {
  const ev = await Evaluation.findById(id);
  if (!ev) throw AppError.notFound();
  if (ev.status === 'accepted' && ev.appliedDelta) {
    await scoreEvents.applyScoreEvent({ employeeId: ev.employeeId, delta: -ev.appliedDelta, reason: `Evaluation ${ev.period} removed: ${reason}`, source: 'admin', refType: 'evaluation', refId: ev._id, idempotencyKey: `eval-remove:${ev._id}`, force: true });
  }
  ev.status = 'removed';
  await ev.save();
  await ledger.append({ entityType: 'evaluation', entityId: ev._id, action: 'removed', subjectId: ev.employeeId, payload: { reason } });
  return ev;
}

// Admin changes ratings (dimensions or answers); applies the score difference instantly and records it in the ledger
async function adminRerate(id, changes, { reason, req } = {}) {
  const ev = await Evaluation.findById(id);
  if (!ev) throw AppError.notFound();
  const cfg = await score.getActiveConfig();
  const before = { ...Object.fromEntries(DIMS.map((d) => [d, ev[d]])), composite: ev.composite, appliedDelta: ev.appliedDelta };
  if (changes.answers) {
    const qById = new Map(ev.answers.map((a) => [String(a.questionId), a]));
    const merged = changes.answers.map((a) => ({ ...(qById.get(String(a.questionId)) || {}), ...a }));
    ev.answers = merged;
    Object.assign(ev, questionnaire.dimsFrom(merged, cfg.neutralComposite));
  }
  DIMS.forEach((d) => { if (changes[d] !== undefined) ev[d] = Number(changes[d]); });
  ev.composite = score.composite(ev, cfg.weights);
  let diff = 0;
  if (ev.status === 'accepted') {
    const employer = await Employer.findById(ev.employerId).lean();
    const ageMonths = (Date.now() - new Date(ev.submittedAt || ev.createdAt).getTime()) / (30 * 864e5);
    const calc = score.evaluationDelta(ev, cfg, { trustTier: employer?.trustTier, ageMonths });
    diff = calc.delta - (ev.appliedDelta || 0);
    ev.appliedDelta = calc.delta;
    ev.weight = calc.weight;
  }
  await ev.save();
  const after = { ...Object.fromEntries(DIMS.map((d) => [d, ev[d]])), composite: ev.composite, appliedDelta: ev.appliedDelta };
  await ledger.append({ entityType: 'evaluation', entityId: ev._id, action: 'admin_rerated', subjectId: ev.employeeId, payload: { before, after, reason: reason || 'Admin re-rating', by: req?.user?._id } });
  if (diff) await scoreEvents.applyScoreEvent({ employeeId: ev.employeeId, delta: diff, reason: `Admin re-rated evaluation ${ev.period}${reason ? `: ${reason}` : ''}`, source: 'admin', refType: 'evaluation', refId: ev._id, idempotencyKey: `rerate:${ev._id}:${Date.now()}`, force: true });
  return { ev, before, after, scoreDelta: diff };
}

queue.register('score.evaluation', processSubmitted);

module.exports = { DIMS, currentPeriod, create, update, processSubmitted, release, remove, accept, adminRerate };
