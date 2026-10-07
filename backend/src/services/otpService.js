const env = require('../config/env');
const OtpToken = require('../models/OtpToken');
const AppError = require('../utils/AppError');
const generateOTP = require('../utils/generateOTP');
const { hmac } = require('../utils/crypto');
const queue = require('../config/queue');
const otpTemplate = require('../templates/email/otp');

const TTL_MS = 10 * 60 * 1000;
const RESEND_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;
const hashCode = (code) => hmac(code, env.jwtSecret);

async function create({ userId, target, purpose, channel = 'email', meta, name }) {
  const recent = await OtpToken.findOne({ target, purpose, consumed: false }).sort({ createdAt: -1 });
  if (recent && Date.now() - recent.createdAt.getTime() < RESEND_MS) throw AppError.tooMany('Please wait 30 seconds before requesting another code');
  const code = generateOTP(6);
  const token = await OtpToken.create({ userId, target, purpose, codeHash: hashCode(code), meta, expiresAt: new Date(Date.now() + TTL_MS) });
  if (channel === 'sms') await queue.enqueue('sms.send', { to: target, text: `Your EIBIL verification code is ${code}. Valid for 10 minutes.` });
  else await queue.enqueue('email.send', { to: target, ...otpTemplate({ name, code, purpose }) });
  return { otpId: token._id, expiresAt: token.expiresAt, ...(env.exposeDevOtp ? { devOtp: code } : {}) };
}

async function verify({ target, purpose, code, otpId }) {
  const filter = otpId ? { _id: otpId, purpose } : { target, purpose };
  const token = await OtpToken.findOne({ ...filter, consumed: false }).sort({ createdAt: -1 });
  if (!token) throw AppError.badRequest('No active code. Please request a new one');
  if (token.expiresAt < new Date()) throw AppError.badRequest('Code expired. Please request a new one');
  if (token.attempts >= MAX_ATTEMPTS) throw AppError.tooMany('Too many incorrect attempts. Request a new code');
  if (token.codeHash !== hashCode(String(code))) {
    token.attempts += 1;
    await token.save();
    throw AppError.badRequest(`Incorrect code. ${MAX_ATTEMPTS - token.attempts} attempts left`);
  }
  token.consumed = true;
  await token.save();
  return token;
}

module.exports = { create, verify };
