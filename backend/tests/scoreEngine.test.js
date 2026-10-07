const test = require('node:test');
const assert = require('node:assert');
const score = require('../src/services/scoreService');

const cfg = { ...score.DEFAULT_CONFIG, version: 1 };

test('composite uses 30/20/25/25 weights', () => {
  assert.strictEqual(score.composite({ performance: 100, professionalism: 0, reliability: 0, conduct: 0 }, cfg.weights), 30);
});

test('evaluation delta = (composite - 75) * 0.6, capped at ±25', () => {
  assert.strictEqual(score.evaluationDelta({ performance: 85, professionalism: 85, reliability: 85, conduct: 85 }, cfg).delta, 6);
  assert.strictEqual(score.evaluationDelta({ performance: 0, professionalism: 0, reliability: 0, conduct: 0 }, cfg).delta, -25);
});

test('trust tier weights the delta', () => {
  const r = { performance: 95, professionalism: 95, reliability: 95, conduct: 95 };
  assert.ok(score.evaluationDelta(r, cfg, { trustTier: 'enterprise' }).delta > score.evaluationDelta(r, cfg, { trustTier: 'flagged' }).delta);
});

test('bands follow the specification', () => {
  assert.strictEqual(score.bandFor(890, cfg.bands), 'Excellent');
  assert.strictEqual(score.bandFor(905, cfg.bands), 'Prime Executive');
  assert.strictEqual(score.bandFor(599, cfg.bands), 'Poor');
});

test('exit rules: layoff neutral, abscond largest penalty with no decay, short notice scaled', () => {
  assert.strictEqual(score.exitDelta({}, 'layoff', cfg).delta, 0);
  const ab = score.exitDelta({}, 'absconded', cfg);
  assert.strictEqual(ab.delta, -200);
  assert.ok(ab.neverDecay && ab.needsAdmin);
  assert.strictEqual(score.exitDelta({ noticeShortfall: 40, buyoutStatus: 'none', handoverStatus: 'yes' }, 'resignation', cfg).delta, -20);
  assert.strictEqual(score.exitDelta({ noticeShortfall: 0, handoverStatus: 'yes', rehireEligibility: 'yes' }, 'resignation', cfg).delta, 8);
});

test('replay is deterministic and clamps to 300-950', () => {
  const entries = [{ payload: { source: 'baseline', newScore: 890 } }, { payload: { source: 'evaluation', delta: 25 } }, { payload: { source: 'evaluation', delta: 50 } }, { payload: { source: 'exit', delta: -200 } }];
  assert.strictEqual(score.replay(entries, cfg), 750);
  assert.strictEqual(score.replay(entries, cfg), score.replay(entries, cfg));
});
