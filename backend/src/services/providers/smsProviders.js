const env = require('../../config/env');
const logger = require('../../config/logger');

const mock = async ({ to }) => logger.info(`[MOCK SMS] to=${String(to).slice(0, 4)}******`);

async function twilio({ to, text }) {
  const { sid, token, from } = env.twilio;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: from, Body: text }),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}`);
}

async function msg91({ to, text }) {
  const res = await fetch('https://control.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: { authkey: env.msg91.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ template_id: env.msg91.templateId, recipients: [{ mobiles: to.replace('+', ''), otp: text.match(/\d{6}/)?.[0] }] }),
  });
  if (!res.ok) throw new Error(`MSG91 ${res.status}`);
}

module.exports = { mock, twilio, msg91 };
