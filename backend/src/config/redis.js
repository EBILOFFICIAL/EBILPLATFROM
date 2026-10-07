const env = require('./env');
const logger = require('./logger');

let connection = null;

async function connectRedis() {
  if (!env.redisUrl) {
    logger.warn('REDIS_URL not set: using in-process queue fallback');
    return null;
  }
  const IORedis = require('ioredis');
  const client = new IORedis(env.redisUrl, { maxRetriesPerRequest: null, lazyConnect: true, retryStrategy: () => null });
  client.on('error', () => {});
  try {
    await Promise.race([client.connect(), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 2000))]);
    await client.ping();
    connection = client;
    logger.info('Redis connected');
  } catch (err) {
    logger.warn(`Redis unavailable (${err.message}): using in-process queue fallback`);
    client.disconnect();
  }
  return connection;
}

module.exports = { connectRedis, getRedis: () => connection };
