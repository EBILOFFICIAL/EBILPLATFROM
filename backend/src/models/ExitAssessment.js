const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;
const schema = new mongoose.Schema({
  separationCaseId: { type: ObjectId, ref: 'SeparationCase', required: true, unique: true },
  noticeRequiredDays: { type: Number, default: 0 },
  noticeServedDays: { type: Number, default: 0 },
  noticeShortfall: { type: Number, default: 0 },
  buyoutStatus: { type: String, enum: ['none', 'paid', 'waived', 'early_release', 'garden_leave'], default: 'none' },
  handoverStatus: { type: String, enum: ['yes', 'partial', 'no'], default: 'yes' },
  assetsReturned: { type: Boolean, default: true },
  exitInterviewDone: { type: Boolean, default: false },
  settlementStatus: { type: String, enum: ['pending', 'completed', 'on_hold'], default: 'pending' },
  rehireEligibility: { type: String, enum: ['yes', 'no', 'conditional'], default: 'yes' },
  conductNotes: String,
  ratings: { performance: Number, professionalism: Number, reliability: Number, conduct: Number },
  disciplinaryEvidence: [{ fileId: String, name: String }],
  comment: { type: String, maxlength: 500 },
  submittedAt: Date,
  publishedAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('ExitAssessment', schema);
