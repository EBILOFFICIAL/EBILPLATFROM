const queue = require('../config/queue');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const { runJob } = require('./jobRunner');

const DAY = 864e5;
const JOBS = {
  scoreRecalc: { fn: require('./scoreRecalcJob'), pattern: '0 2 * * *', every: DAY, label: 'Nightly score recalculation from ledger' },
  ledgerIntegrity: { fn: require('./ledgerIntegrityJob'), pattern: '30 2 * * *', every: DAY, label: 'Ledger hash-chain integrity check' },
  penaltyDecay: { fn: require('./penaltyDecayJob'), pattern: '0 3 * * *', every: DAY, label: 'Negative event decay' },
  exitReminder: { fn: require('./exitReminderJob'), pattern: '0 * * * *', every: 3600e3, label: 'Exit deadlines, reminders and publishing' },
  offerExpiry: { fn: require('./offerExpiryJob'), pattern: '15 * * * *', every: 3600e3, label: 'Offer expiry and no-show penalties' },
  evaluationReminder: { fn: require('./evaluationReminderJob'), pattern: '0 9 * * 1', every: 7 * DAY, label: 'Weekly evaluation due reminders' },
  tenureScore: { fn: require('./tenureScoreJob'), pattern: '0 4 1 * *', every: 30 * DAY, label: 'Monthly tenure milestone boosts' },
  identityRecheck: { fn: require('./identityRecheckJob'), pattern: '0 5 1 * *', every: 30 * DAY, label: 'Annual PAN re-verification' },
};

function registerHandlers() {
  queue.register('email.send', (d) => emailService.send(d));
  queue.register('sms.send', (d) => smsService.send(d));
  Object.entries(JOBS).forEach(([name, j]) => queue.register(`job.${name}`, (d) => runJob(name, j.fn, d.trigger || 'schedule')));
}

async function scheduleAll() {
  for (const [name, j] of Object.entries(JOBS)) await queue.schedule(`job.${name}`, j.pattern, j.every);
}

const runNow = (name) => {
  if (!JOBS[name]) throw new Error(`Unknown job ${name}`);
  return runJob(name, JOBS[name].fn, 'manual');
};

const catalog = () => Object.entries(JOBS).map(([name, j]) => ({ name, label: j.label, schedule: j.pattern }));

module.exports = { registerHandlers, scheduleAll, runNow, catalog };
