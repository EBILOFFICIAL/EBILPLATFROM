const ScoreConfig = require('../models/ScoreConfig');
const EmployeeProfile = require('../models/EmployeeProfile');
const Evaluation = require('../models/Evaluation');
const ScoreEvent = require('../models/ScoreEvent');
const Employer = require('../models/Employer');
const { ScoreAdjustment } = require('../models/misc');
const AppError = require('../utils/AppError');
const score = require('./scoreService');
const scoreEvents = require('./scoreEventService');

const PARAMS = ['baseline', 'min', 'max', 'bands', 'weights', 'sensitivityK', 'neutralComposite', 'cycleCap', 'recencyHalfLifeMonths', 'trustTierWeights', 'exitRules', 'events'];

const list = () => ScoreConfig.find().sort({ version: -1 }).populate('createdBy approvedBy', 'name email').lean();

async function createDraft(data, user) {
  const active = await score.getActiveConfig();
  const last = await ScoreConfig.findOne().sort({ version: -1 }).lean();
  const base = Object.fromEntries(PARAMS.map((p) => [p, data[p] !== undefined ? data[p] : active[p]]));
  return ScoreConfig.create({ ...base, version: (last?.version || 0) + 1, status: 'draft', notes: data.notes, createdBy: user._id });
}

async function updateDraft(id, data) {
  const cfg = await ScoreConfig.findById(id);
  if (!cfg || cfg.status !== 'draft') throw AppError.badRequest('Only drafts can be edited');
  PARAMS.forEach((p) => { if (data[p] !== undefined) cfg[p] = data[p]; });
  if (data.notes !== undefined) cfg.notes = data.notes;
  cfg.markModified('exitRules'); cfg.markModified('events'); cfg.markModified('weights'); cfg.markModified('bands');
  return cfg.save();
}

async function submit(id) {
  const cfg = await ScoreConfig.findOneAndUpdate({ _id: id, status: 'draft' }, { status: 'pending_approval' }, { new: true });
  if (!cfg) throw AppError.badRequest('Only drafts can be submitted');
  return cfg;
}

async function decide(id, user, approve) {
  const cfg = await ScoreConfig.findById(id);
  if (!cfg || cfg.status !== 'pending_approval') throw AppError.badRequest('Config is not pending approval');
  if (String(cfg.createdBy) === String(user._id)) throw AppError.forbidden('Maker-checker: a different admin must approve this config');
  if (!approve) { cfg.status = 'rejected'; return cfg.save(); }
  await ScoreConfig.updateMany({ status: 'active' }, { status: 'archived' });
  Object.assign(cfg, { status: 'active', approvedBy: user._id, activatedAt: new Date() });
  await cfg.save();
  score.clearConfigCache();
  return cfg;
}

async function rollback(version, user) {
  const old = await ScoreConfig.findOne({ version }).lean();
  if (!old) throw AppError.notFound('Version not found');
  const draft = await createDraft({ ...old, notes: `Rollback to v${version}` }, user);
  return submit(draft._id);
}

async function preview(id, n = 50) {
  const cfgDoc = await ScoreConfig.findById(id).lean();
  if (!cfgDoc) throw AppError.notFound();
  const cfg = { ...score.DEFAULT_CONFIG, ...cfgDoc };
  const profiles = await EmployeeProfile.find({ panVerified: true }).limit(Number(n)).lean();
  const tiers = Object.fromEntries((await Employer.find().select('trustTier').lean()).map((e) => [String(e._id), e.trustTier]));
  const rows = [];
  for (const p of profiles) {
    const evals = await Evaluation.find({ employeeId: p._id, status: 'accepted' }).lean();
    const others = await ScoreEvent.find({ employeeId: p._id, source: { $nin: ['baseline', 'evaluation'] } }).lean();
    let simulated = cfg.baseline;
    evals.forEach((e) => { simulated = score.clamp(simulated + score.evaluationDelta(e, cfg, { trustTier: tiers[String(e.employerId)] }).delta, cfg.min, cfg.max); });
    others.forEach((o) => { simulated = score.clamp(simulated + o.delta, cfg.min, cfg.max); });
    rows.push({ eibilId: p.eibilId, name: p.fullName, current: p.currentScore, simulated, change: simulated - (p.currentScore || 0), currentBand: p.band, simulatedBand: score.bandFor(simulated, cfg.bands) });
  }
  const avgChange = rows.length ? Math.round((rows.reduce((a, r) => a + r.change, 0) / rows.length) * 10) / 10 : 0;
  return { version: cfgDoc.version, sampled: rows.length, avgChange, bandChanges: rows.filter((r) => r.currentBand !== r.simulatedBand).length, rows };
}

const requestAdjustment = (data, user) => ScoreAdjustment.create({ ...data, requestedBy: user._id });

async function decideAdjustment(id, user, approve) {
  const adj = await ScoreAdjustment.findById(id);
  if (!adj || adj.status !== 'pending') throw AppError.badRequest('Adjustment is not pending');
  if (String(adj.requestedBy) === String(user._id)) throw AppError.forbidden('Dual approval: a different admin must approve this adjustment');
  adj.status = approve ? 'approved' : 'rejected';
  adj.approvedBy = user._id;
  await adj.save();
  if (approve) await scoreEvents.applyScoreEvent({ employeeId: adj.employeeId, delta: adj.delta, reason: `Manual adjustment: ${adj.reason}`, source: 'admin', refType: 'adjustment', refId: adj._id, idempotencyKey: `adjust:${adj._id}`, force: true });
  return adj;
}

const adjustments = () => ScoreAdjustment.find().populate('employeeId', 'fullName eibilId currentScore').populate('requestedBy approvedBy', 'name').sort({ createdAt: -1 }).lean();

module.exports = { list, createDraft, updateDraft, submit, decide, rollback, preview, requestAdjustment, decideAdjustment, adjustments };
