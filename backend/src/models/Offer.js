const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;
const schema = new mongoose.Schema({
  employeeId: { type: ObjectId, ref: 'EmployeeProfile', required: true, index: true },
  employerId: { type: ObjectId, ref: 'Employer', index: true },
  companyName: String,
  designation: { type: String, required: true },
  department: String,
  location: String,
  offerDate: Date,
  validUntil: Date,
  expectedJoiningDate: Date,
  documentFileId: String,
  documentHash: String,
  ctcPrivate: { type: Number, select: false },
  source: { type: String, enum: ['employer', 'self_declared'], default: 'employer' },
  verified: { type: Boolean, default: false },
  confirmToken: String,
  status: { type: String, enum: ['issued', 'accepted', 'joined', 'declined', 'expired', 'no_show', 'withdrawn'], default: 'issued' },
  withdrawalReason: String,
  overlapFlag: { type: Boolean, default: false },
  noShowDisputeEndsAt: Date,
  noShowPenaltyApplied: { type: Boolean, default: false },
  confirmedBy: { type: ObjectId, ref: 'User' },
  stateHistory: [{ status: String, by: ObjectId, at: Date, note: String }],
}, { timestamps: true });

module.exports = mongoose.model('Offer', schema);
