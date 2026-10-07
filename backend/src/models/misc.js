const mongoose = require('mongoose');

const { ObjectId, Mixed } = mongoose.Schema.Types;

const Notification = mongoose.model('Notification', new mongoose.Schema({
  userId: { type: ObjectId, ref: 'User', index: true },
  title: String,
  body: String,
  link: String,
  read: { type: Boolean, default: false },
}, { timestamps: true }));

const VerificationCheck = mongoose.model('VerificationCheck', new mongoose.Schema({
  employerId: { type: ObjectId, ref: 'Employer', index: true },
  employeeId: { type: ObjectId, ref: 'EmployeeProfile', index: true },
  viewerUserId: { type: ObjectId, ref: 'User' },
  consentId: { type: ObjectId, ref: 'Consent' },
  creditsUsed: { type: Number, default: 1 },
  snapshot: Mixed,
  verifyToken: { type: String, index: true },
}, { timestamps: true }));

const Setting = mongoose.model('Setting', new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  value: Mixed,
  group: { type: String, default: 'general' },
  description: String,
}, { timestamps: true }));

const Coupon = mongoose.model('Coupon', new mongoose.Schema({
  code: { type: String, unique: true, uppercase: true, required: true },
  percentOff: { type: Number, default: 0 },
  flatOff: { type: Number, default: 0 },
  maxUses: { type: Number, default: 100 },
  used: { type: Number, default: 0 },
  validUntil: Date,
  active: { type: Boolean, default: true },
}, { timestamps: true }));

const Session = mongoose.model('Session', new mongoose.Schema({
  userId: { type: ObjectId, ref: 'User', index: true },
  jti: { type: String, unique: true },
  ip: String,
  userAgent: String,
  revoked: { type: Boolean, default: false },
  expiresAt: Date,
}, { timestamps: true }));

const Watchlist = mongoose.model('Watchlist', new mongoose.Schema({
  type: { type: String, enum: ['pan', 'email_domain', 'employer', 'ip', 'email'], required: true },
  value: { type: String, required: true },
  reason: String,
  addedBy: { type: ObjectId, ref: 'User' },
}, { timestamps: true }));

const ScoreAdjustment = mongoose.model('ScoreAdjustment', new mongoose.Schema({
  employeeId: { type: ObjectId, ref: 'EmployeeProfile', required: true },
  delta: { type: Number, required: true },
  reason: { type: String, required: true },
  requestedBy: { type: ObjectId, ref: 'User' },
  approvedBy: { type: ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
}, { timestamps: true }));

const CreditTransaction = mongoose.model('CreditTransaction', new mongoose.Schema({
  employerId: { type: ObjectId, ref: 'Employer', index: true },
  amount: Number,
  balanceAfter: Number,
  reason: String,
  refId: String,
  by: { type: ObjectId, ref: 'User' },
}, { timestamps: true }));

const Document = mongoose.model('Document', new mongoose.Schema({
  ownerId: { type: ObjectId, ref: 'User', index: true },
  purpose: String,
  name: String,
  mimeType: String,
  size: Number,
  sha256: String,
  provider: String,
  storageKey: String,
  url: String,
  status: { type: String, enum: ['uploaded', 'approved', 'rejected'], default: 'uploaded' },
}, { timestamps: true }));

const Broadcast = mongoose.model('Broadcast', new mongoose.Schema({
  segment: { type: String, enum: ['all', 'employees', 'employers', 'admins'], default: 'all' },
  title: String,
  body: String,
  sendEmail: Boolean,
  delivered: Number,
  sentBy: { type: ObjectId, ref: 'User' },
}, { timestamps: true }));

const MessageLog = mongoose.model('MessageLog', new mongoose.Schema({
  channel: { type: String, enum: ['email', 'sms'] },
  to: String,
  subject: String,
  provider: String,
  status: String,
  preview: String,
  error: String,
}, { timestamps: true }));

module.exports = { Notification, VerificationCheck, Setting, Coupon, Session, Watchlist, ScoreAdjustment, CreditTransaction, Document, Broadcast, MessageLog };
