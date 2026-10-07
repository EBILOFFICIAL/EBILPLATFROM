const logger = require('./logger');
const { getRedis } = require('./redis');

const handlers = {};
let queue = null;
let mode = 'inline';

const register = (name, fn) => { handlers[name] = fn; };

async function run(name, data) {
  const fn = handlers[name];
  if (!fn) throw new Error(`No queue handler for ${name}`);
  return fn(data || {});
}

function initQueue() {
  const connection = getRedis();
  if (!connection) return;
  const { Queue, Worker } = require('bullmq');
  queue = new Queue('eibil', { connection });
  const worker = new Worker('eibil', (job) => run(job.name, job.data), { connection: connection.duplicate(), concurrency: 5 });
  worker.on('failed', (job, err) => logger.error(`Job ${job?.name} failed: ${err.message}`));
  mode = 'bullmq';
}

async function enqueue(name, data) {
  if (queue) return queue.add(name, data, { removeOnComplete: 200, removeOnFail: 500, attempts: 3 });
  setImmediate(() => run(name, data).catch((err) => logger.error(`Inline job ${name} failed: ${err.message}`)));
  return { inline: true };
}

async function schedule(name, pattern, intervalMs) {
  if (queue) return queue.add(name, {}, { repeat: { pattern }, jobId: `repeat-${name}` });
  setInterval(() => run(name, {}).catch((err) => logger.error(`Scheduled ${name} failed: ${err.message}`)), intervalMs).unref();
  return null;
}

module.exports = { register, enqueue, schedule, run, initQueue, getMode: () => mode };
