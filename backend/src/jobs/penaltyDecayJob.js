const ScoreEvent = require('../models/ScoreEvent');
const score = require('../services/scoreService');
const scoreEvents = require('../services/scoreEventService');

module.exports = async () => {
  const cfg = await score.getActiveConfig();
  const cutoff = new Date(Date.now() - cfg.events.negativeDecayMonths * 30 * 864e5);
  const old = await ScoreEvent.find({ negative: true, neverDecay: false, decayed: false, delta: { $lt: 0 }, createdAt: { $lt: cutoff } });
  let changes = 0;
  for (const ev of old) {
    const r = await scoreEvents.applyScoreEvent({ employeeId: ev.employeeId, delta: -ev.delta, reason: `Penalty decayed after ${cfg.events.negativeDecayMonths} months: ${ev.reason}`, source: 'decay', refType: 'score_event', refId: ev._id, idempotencyKey: `decay:${ev._id}` }).catch(() => null);
    if (r) { ev.decayed = true; await ev.save(); changes += 1; }
  }
  return { processed: old.length, changes };
};
