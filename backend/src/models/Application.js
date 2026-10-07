const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;
const schema = new mongoose.Schema({
  jobId: { type: ObjectId, ref: 'Job', required: true, index: true },
  employerId: { type: ObjectId, ref: 'Employer', index: true },
  employeeId: { type: ObjectId, ref: 'EmployeeProfile', required: true, index: true },
  resumeUrl: String,
  answers: [{ question: String, answer: String }],
  scoreAtApply: Number,
  bandAtApply: String,
  status: { type: String, enum: ['applied', 'shortlisted', 'interview', 'offer', 'hired', 'rejected'], default: 'applied' },
  notes: [{ text: String, by: ObjectId, at: Date }],
  history: [{ status: String, by: ObjectId, at: Date }],
  consentId: { type: ObjectId, ref: 'Consent' },
}, { timestamps: true });

schema.index({ jobId: 1, employeeId: 1 }, { unique: true });

module.exports = mongoose.model('Application', schema);
