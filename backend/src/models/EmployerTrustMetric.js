const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employer', required: true, unique: true },
  offersIssued: { type: Number, default: 0 },
  offersWithdrawn: { type: Number, default: 0 },
  acceptedWithdrawn: { type: Number, default: 0 },
  verificationsDone: { type: Number, default: 0 },
  avgResponseHours: { type: Number, default: 0 },
  exitAssessmentsDue: { type: Number, default: 0 },
  exitAssessmentsOnTime: { type: Number, default: 0 },
  manualAdjustment: { type: Number, default: 0 },
  trustIndex: { type: Number, default: 100 },
}, { timestamps: true });

module.exports = mongoose.model('EmployerTrustMetric', schema);
