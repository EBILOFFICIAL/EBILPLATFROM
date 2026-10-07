const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const required = ['MONGO_URL', 'DB_NAME', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'PAN_ENCRYPTION_KEY', 'PAN_HASH_SECRET', 'CLIENT_URL'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) throw new Error(`Missing required env vars: ${missing.join(', ')}`);

const e = process.env;
module.exports = {
  nodeEnv: e.NODE_ENV || 'development',
  port: Number(e.NODE_PORT || 8002),
  mongoUrl: e.MONGO_URL,
  dbName: e.DB_NAME,
  clientUrl: e.CLIENT_URL,
  corsOrigins: (e.CORS_ALLOWLIST || e.CLIENT_URL).split(',').map((s) => s.trim()),
  jwtSecret: e.JWT_SECRET,
  jwtRefreshSecret: e.JWT_REFRESH_SECRET,
  accessTtl: e.JWT_ACCESS_TTL || '15m',
  refreshTtlDays: Number(e.JWT_REFRESH_TTL_DAYS || 7),
  panEncryptionKey: e.PAN_ENCRYPTION_KEY,
  panHashSecret: e.PAN_HASH_SECRET,
  panProvider: e.PAN_PROVIDER || 'mock',
  panProviderKey: e.PAN_PROVIDER_KEY,
  panProviderUrl: e.PAN_PROVIDER_URL,
  kycProvider: e.KYC_PROVIDER || 'mock',
  emailProvider: e.EMAIL_PROVIDER || 'mock',
  emailFrom: e.EMAIL_FROM || 'EIBIL <no-reply@eibil.in>',
  smtp: { host: e.SMTP_HOST, port: Number(e.SMTP_PORT || 587), user: e.SMTP_USER, pass: e.SMTP_PASS },
  sendgridKey: e.SENDGRID_API_KEY,
  resendKey: e.RESEND_API_KEY,
  smsProvider: e.SMS_PROVIDER || 'mock',
  twilio: { sid: e.TWILIO_ACCOUNT_SID, token: e.TWILIO_AUTH_TOKEN, from: e.TWILIO_FROM },
  msg91: { key: e.MSG91_AUTH_KEY, templateId: e.MSG91_TEMPLATE_ID },
  storageProvider: e.STORAGE_PROVIDER || 'local',
  cloudinary: { cloudName: e.CLOUDINARY_CLOUD_NAME, apiKey: e.CLOUDINARY_API_KEY, apiSecret: e.CLOUDINARY_API_SECRET },
  fileSigningSecret: e.FILE_SIGNING_SECRET || e.JWT_SECRET,
  razorpay: { keyId: e.RAZORPAY_KEY_ID, keySecret: e.RAZORPAY_KEY_SECRET, webhookSecret: e.RAZORPAY_WEBHOOK_SECRET, mode: e.RAZORPAY_MODE || 'mock' },
  redisUrl: e.REDIS_URL,
  exposeDevOtp: e.EXPOSE_DEV_OTP === 'true',
  publicApiUrl: e.PUBLIC_API_URL || e.CLIENT_URL,
};
