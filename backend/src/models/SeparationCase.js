const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;
const schema = new mongoose.Schema({
  employmentRecordId: { type: ObjectId, ref: 'EmploymentRecord', required: true },
  employeeId: { type: ObjectId, ref: 'EmployeeProfile', required: true, index: true },
  employerId: { type: ObjectId, ref: 'Employer', required: true, index: true },
  initiatedBy: { type: String, enum: ['employee', 'employer'], required: true },
  separationType: { type: String, required: true },
  reasonCategory: String,
  resignationDate: Date,
  lastWorkingDay: Date,
  proposedDates: { resignationDate: Date, lastWorkingDay: Date },
  status: { type: String, default: 'awaiting_confirmation' },
  assessmentDueAt: Date,
  reviewWindowEndsAt: Date,
  employeeResponse: { type: String, enum: ['none', 'accepted', 'rebutted', 'disputed'], default: 'none' },
  adminReviewed: { type: Boolean, default: false },
  adminReviewNote: String,
  remindersSent: { type: Number, default: 0 },
  scoreDelta: Number,
  publishedAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('SeparationCase', schema);
