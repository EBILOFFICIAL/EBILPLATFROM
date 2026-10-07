const env = require('./config/env');
const logger = require('./config/logger');
const { connectDB } = require('./config/db');
const { connectRedis } = require('./config/redis');
const queue = require('./config/queue');
const jobs = require('./jobs');
require('./services/evaluationService');
const app = require('./app');

async function start() {
  await connectDB();
  await connectRedis();
  jobs.registerHandlers();
  queue.initQueue();
  await jobs.scheduleAll();
  app.listen(env.port, '127.0.0.1', () => logger.info(`EIBIL API listening on ${env.port} (queue: ${queue.getMode()})`));
}

start().catch((err) => {
  logger.error(`Startup failed: ${err.message}`);
  process.exit(1);
});
