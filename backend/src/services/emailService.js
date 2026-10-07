const env = require('../config/env');
const logger = require('../config/logger');
const { MessageLog } = require('../models/misc');
const providers = require('./providers/emailProviders');

async function send({ to, subject, html, text }) {
  const provider = providers[env.emailProvider] || providers.mock;
  try {
    await provider({ to, subject, html, text, from: env.emailFrom });
    await MessageLog.create({ channel: 'email', to, subject, provider: env.emailProvider, status: 'sent', preview: (text || '').slice(0, 200) });
  } catch (err) {
    logger.error(`Email send failed: ${err.message}`);
    await MessageLog.create({ channel: 'email', to, subject, provider: env.emailProvider, status: 'failed', error: err.message });
  }
}

module.exports = { send };
