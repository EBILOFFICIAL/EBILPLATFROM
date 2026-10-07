const mongoose = require('mongoose');

const employerSchema = new mongoose.Schema({
  companyName: { type: String, required: true, trim: true },
  cin: String,
  gstin: String,
  companyPanHash: String,
  domain: { type: String, lowercase: true, index: true },
  industry: String,
  city: String,
  hrContactName: String,
  phone: String,
  kycStatus: { type: String, enum: ['pending', 'approved', 'rejected', 'suspended'], default: 'pending' },
  kycNotes: String,
  kycCheckedAt: Date,
  trustTier: { type: String, enum: ['standard', 'verified', 'enterprise', 'flagged'], default: 'standard' },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
  planExpiresAt: Date,
  creditBalance: { type: Number, default: 0 },
  jobPostsUsed: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
}, { timestamps: true });

module.exports = mongoose.model('Employer', employerSchema);
