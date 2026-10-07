const env = require('../config/env');
const logger = require('../config/logger');
const { MessageLog } = require('../models/misc');
const providers = require('./providers/smsProviders');

async function send({ to, text }) {
  const provider = providers[env.smsProvider] || providers.mock;
  try {
    await provider({ to, text });
    await MessageLog.create({ channel: 'sms', to, provider: env.smsProvider, status: 'sent', preview: text.replace(/\d{6}/, '******') });
  } catch (err) {
    logger.error(`SMS send failed: ${err.message}`);
    await MessageLog.create({ channel: 'sms', to, provider: env.smsProvider, status: 'failed', error: err.message });
  }
}

module.exports = { send };
