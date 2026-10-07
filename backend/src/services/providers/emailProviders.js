const env = require('../../config/env');
const logger = require('../../config/logger');

const mock = async ({ to, subject }) => logger.info(`[MOCK EMAIL] to=${to} subject="${subject}"`);

async function smtp({ to, subject, html, text, from }) {
  const nodemailer = require('nodemailer');
  const t = nodemailer.createTransport({ host: env.smtp.host, port: env.smtp.port, secure: env.smtp.port === 465, auth: { user: env.smtp.user, pass: env.smtp.pass } });
  await t.sendMail({ from, to, subject, html, text });
}

async function sendgrid({ to, subject, html, text, from }) {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.sendgridKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ personalizations: [{ to: [{ email: to }] }], from: { email: from.match(/<(.+)>/)?.[1] || from }, subject, content: [{ type: 'text/plain', value: text || subject }, { type: 'text/html', value: html }] }),
  });
  if (!res.ok) throw new Error(`SendGrid ${res.status}`);
}

async function resend({ to, subject, html, from }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}`);
}

module.exports = { mock, smtp, ses: smtp, sendgrid, resend };
