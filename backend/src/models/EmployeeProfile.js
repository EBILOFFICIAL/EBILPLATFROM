const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;
const profileSchema = new mongoose.Schema({
  userId: { type: ObjectId, ref: 'User', index: true },
  eibilId: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  dob: Date,
  photo: String,
  location: String,
  headline: String,
  experienceYears: { type: Number, default: 0 },
  panEncrypted: { type: String, select: false },
  panHash: { type: String },
  panMasked: String,
  panStatus: { type: String, enum: ['not_submitted', 'verified', 'pending_review', 'rejected', 'invalid'], default: 'not_submitted' },
  panVerified: { type: Boolean, default: false },
  panVerifiedAt: Date,
  panProviderRef: String,
  panProviderName: String,
  panNameScore: Number,
  panAttempts: { type: Number, default: 0 },
  panLockedUntil: Date,
  isShell: { type: Boolean, default: false },
  claimedAt: Date,
  currentScore: { type: Number, default: null },
  band: String,
  scoreUpdatedAt: Date,
  scorePaused: { type: Boolean, default: false },
  scoreFrozen: { type: Boolean, default: false },
  openToWork: { type: Boolean, default: false },
  visibility: {
    showExactScore: { type: Boolean, default: false },
    hideFromEmployerIds: [{ type: ObjectId, ref: 'Employer' }],
    hideOfferStatusFromEmployerIds: [{ type: ObjectId, ref: 'Employer' }],
    allowCurrentEmployerOfferView: { type: Boolean, default: false },
  },
  skills: [String],
  education: [{ institution: String, degree: String, year: Number }],
  savedJobIds: [{ type: ObjectId, ref: 'Job' }],
  resumeUrl: String,
  resumeId: { type: ObjectId, ref: 'Resume' },
  deletionRequestedAt: Date,
}, { timestamps: true });

profileSchema.index({ panHash: 1 }, { unique: true, partialFilterExpression: { panHash: { $type: 'string' } } });
profileSchema.index({ fullName: 1, dob: 1 });

module.exports = mongoose.model('EmployeeProfile', profileSchema);
