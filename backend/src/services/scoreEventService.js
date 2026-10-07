const EmployeeProfile = require('../models/EmployeeProfile');
const ScoreEvent = require('../models/ScoreEvent');
const AppError = require('../utils/AppError');
const ledger = require('./ledgerService');
const score = require('./scoreService');
const notify = require('./notificationService');
const env = require('../config/env');
const scoreChangeEmail = require('../templates/email/scoreChange');

async function applyScoreEvent({ employeeId, delta, reason, source, refType, refId, evaluationId, negative = delta < 0, neverDecay = false, idempotencyKey, force = false }) {
  if (idempotencyKey) {
    const existing = await ScoreEvent.findOne({ idempotencyKey });
    if (existing) return existing;
  }
  const profile = await EmployeeProfile.findById(employeeId);
  if (!profile) throw AppError.notFound('Profile not found');
  if (!profile.panVerified && source !== 'baseline') return null;
  if ((profile.scorePaused || profile.scoreFrozen) && !force) throw new AppError('Score updates are paused for this profile', 423);
  const cfg = await score.getActiveConfig();
  const oldScore = source === 'baseline' ? null : (profile.currentScore ?? cfg.baseline);
  const newScore = source === 'baseline' ? cfg.baseline : score.clamp(oldScore + delta, cfg.min, cfg.max);
  const ev = await ScoreEvent.create({
    employeeId, oldScore, newScore, delta: source === 'baseline' ? 0 : delta, reason, source, refType, refId, evaluationId,
    configVersion: cfg.version, negative, neverDecay, idempotencyKey,
  });
  const entry = await ledger.append({
    entityType: 'score_event', entityId: ev._id, action: source, subjectId: employeeId,
    payload: { employeeId, oldScore, newScore, delta: ev.delta, source, reason, refType, refId, configVersion: cfg.version },
  });
  ev.ledgerSeq = entry.seq;
  await ev.save();
  profile.currentScore = newScore;
  profile.band = score.bandFor(newScore, cfg.bands);
  profile.scoreUpdatedAt = new Date();
  await profile.save();
  if (profile.userId && ev.delta !== 0) {
    const meta = { oldScore, newScore, delta: ev.delta, reason, source, scoreEventId: ev._id };
    await notify.notify(profile.userId, {
      type: 'score', meta, link: '/employee/score',
      title: `Your EIBIL score ${ev.delta > 0 ? 'increased' : 'decreased'} by ${Math.abs(ev.delta)} points`,
      body: `${reason}. ${oldScore} → ${newScore}.`,
      email: Math.abs(ev.delta) >= (cfg.events.notifyThreshold ?? 3),
      emailContent: (u) => scoreChangeEmail({ name: u.name, ...meta, link: `${env.clientUrl}/employee/score` }),
    });
  }
  return ev;
}

const initBaseline = (profileId) => applyScoreEvent({ employeeId: profileId, delta: 0, reason: 'Baseline score on PAN-verified profile', source: 'baseline', idempotencyKey: `baseline:${profileId}`, force: true });

async function recalculate(employeeId, { persist = true } = {}) {
  const cfg = await score.getActiveConfig();
  const entries = await ledger.entriesFor(employeeId, 'score_event');
  const ledgerScore = score.replay(entries, cfg);
  const profile = await EmployeeProfile.findById(employeeId);
  const stored = profile.currentScore;
  if (persist && ledgerScore !== null && stored !== ledgerScore) {
    profile.currentScore = ledgerScore;
    profile.band = score.bandFor(ledgerScore, cfg.bands);
  }
  if (persist) { profile.scoreUpdatedAt = new Date(); await profile.save(); }
  return { employeeId, ledgerScore, storedScore: stored, match: stored === ledgerScore, events: entries.length };
}

const history = (employeeId) => ScoreEvent.find({ employeeId }).sort({ createdAt: 1 }).lean();

module.exports = { applyScoreEvent, initBaseline, recalculate, history };
