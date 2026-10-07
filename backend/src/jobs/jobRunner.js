const ScoreJobRun = require('../models/ScoreJobRun');
const logger = require('../config/logger');

async function runJob(jobType, fn, trigger = 'schedule') {
  const run = await ScoreJobRun.create({ jobType, trigger, startedAt: new Date() });
  try {
    const result = (await fn()) || {};
    Object.assign(run, { status: 'completed', finishedAt: new Date(), profilesProcessed: result.processed || 0, changes: result.changes || 0, failures: result.failures || 0, log: result.log || [], result: result.extra });
  } catch (err) {
    logger.error(`Job ${jobType} failed: ${err.message}`);
    Object.assign(run, { status: 'failed', finishedAt: new Date(), log: [err.message], failures: 1 });
  }
  return run.save();
}

module.exports = { runJob };
