const ScoreConfig = require('../models/ScoreConfig');
const { DEFAULT_BANDS, TRUST_TIERS } = require('../constants');

const DEFAULT_CONFIG = {
  baseline: 890,
  min: 300,
  max: 950,
  bands: DEFAULT_BANDS,
  weights: { performance: 30, professionalism: 20, reliability: 25, conduct: 25 },
  sensitivityK: 0.6,
  neutralComposite: 75,
  cycleCap: 25,
  recencyHalfLifeMonths: 24,
  trustTierWeights: TRUST_TIERS,
  exitRules: {
    fullNoticeBoost: 8,
    minorGapThresholdDays: 7,
    shortNoticePenaltyPerDay: 0.5,
    shortNoticeMaxPenalty: 30,
    handoverIncompletePenalty: 5,
    misconductPenalty: 120,
    abscondPenalty: 200,
  },
  events: {
    noShowPenalty: 15,
    noShowDisputeWindowDays: 7,
    achievementBoost: 5,
    achievementYearCap: 15,
    tenureBoosts: { 1: 4, 3: 6, 5: 10 },
    negativeDecayMonths: 36,
    disputeHoldsScore: true,
    notifyThreshold: 3,
    minTenureDaysToRate: 30,
    reviewWindowDays: 7,
    exitSubmissionDays: 15,
    outlierStdDev: 2,
    disputeUpheldPenalty: 0,
  },
};

let cached = null;

async function getActiveConfig() {
  if (cached) return cached;
  const doc = await ScoreConfig.findOne({ status: 'active' }).sort({ version: -1 }).lean();
  cached = doc ? { ...DEFAULT_CONFIG, ...doc, exitRules: { ...DEFAULT_CONFIG.exitRules, ...doc.exitRules }, events: { ...DEFAULT_CONFIG.events, ...doc.events } } : { ...DEFAULT_CONFIG, version: 0 };
  return cached;
}

const clearConfigCache = () => { cached = null; };
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function bandFor(score, bands = DEFAULT_BANDS) {
  if (score == null) return null;
  const b = bands.find((x) => score >= x.min && score <= x.max);
  return b ? b.name : bands[bands.length - 1].name;
}

function composite(r, weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const sum = Object.entries(weights).reduce((acc, [k, w]) => acc + (Number(r[k]) || 0) * w, 0);
  return Math.round((sum / total) * 100) / 100;
}

function evaluationDelta(ratings, cfg, { trustTier = 'standard', ageMonths = 0 } = {}) {
  const c = composite(ratings, cfg.weights);
  const raw = (c - cfg.neutralComposite) * cfg.sensitivityK;
  const capped = clamp(raw, -cfg.cycleCap, cfg.cycleCap);
  const trust = (cfg.trustTierWeights || TRUST_TIERS)[trustTier] ?? 1;
  const recency = 0.5 ** (ageMonths / cfg.recencyHalfLifeMonths);
  const weight = Math.round(trust * recency * 1000) / 1000;
  return { composite: c, raw, capped, weight, delta: Math.round(capped * weight) };
}

function exitDelta(assessment, separationType, cfg) {
  const r = cfg.exitRules;
  if (['layoff', 'end_of_contract', 'retirement', 'mutual_separation'].includes(separationType)) return { delta: 0, reason: 'Neutral separation (never penalised)' };
  if (separationType === 'absconded') return { delta: -r.abscondPenalty, reason: 'Absconded (verified, admin-reviewed)', negative: true, neverDecay: true, needsAdmin: true };
  if (separationType === 'termination_misconduct') return { delta: -r.misconductPenalty, reason: 'Terminated for misconduct (verified, admin-reviewed)', negative: true, needsAdmin: true };
  const shortfall = Math.max(0, assessment.noticeShortfall || 0);
  const excused = ['paid', 'waived', 'early_release', 'garden_leave'].includes(assessment.buyoutStatus);
  let delta = 0;
  const reasons = [];
  if (shortfall > r.minorGapThresholdDays && !excused) {
    delta -= Math.min(r.shortNoticeMaxPenalty, Math.round(shortfall * r.shortNoticePenaltyPerDay));
    reasons.push(`Short notice by ${shortfall} days without buyout/approval`);
  }
  if (assessment.handoverStatus === 'no') { delta -= r.handoverIncompletePenalty; reasons.push('Handover not completed'); }
  if (delta === 0 && shortfall === 0 && assessment.handoverStatus === 'yes' && assessment.rehireEligibility === 'yes') {
    return { delta: r.fullNoticeBoost, reason: 'Full notice served, handover complete, rehire eligible' };
  }
  if (delta === 0) return { delta: 0, reason: 'Notice served with minor gaps (neutral)' };
  return { delta, reason: reasons.join('; '), negative: true };
}

function replay(entries, cfg) {
  let score = null;
  entries.forEach((e) => {
    const p = e.payload;
    score = p.source === 'baseline' ? p.newScore : clamp((score ?? cfg.baseline) + p.delta, cfg.min, cfg.max);
  });
  return score;
}

module.exports = { DEFAULT_CONFIG, getActiveConfig, clearConfigCache, clamp, bandFor, composite, evaluationDelta, exitDelta, replay };
