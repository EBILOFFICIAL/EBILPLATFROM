const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;
const schema = new mongoose.Schema({
  employeeId: { type: ObjectId, ref: 'EmployeeProfile', required: true, index: true },
  requesterEmployerId: { type: ObjectId, ref: 'Employer', index: true },
  type: { type: String, enum: ['report_access', 'pan_verification', 'reference_check'], default: 'report_access' },
  purpose: String,
  scope: { type: String, default: 'full_report' },
  mode: { type: String, enum: ['on_demand', 'otp', 'job_application', 'self'], default: 'on_demand' },
  status: { type: String, enum: ['pending', 'granted', 'denied', 'revoked', 'expired'], default: 'pending' },
  consentTextVersion: String,
  otpTokenId: ObjectId,
  expiresAt: Date,
  respondedAt: Date,
  ip: String,
}, { timestamps: true });

module.exports = mongoose.model('Consent', schema);
