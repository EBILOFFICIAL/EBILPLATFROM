const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;
const schema = new mongoose.Schema({
  targetType: { type: String, enum: ['evaluation', 'employment', 'offer', 'separation', 'score_event'], required: true },
  targetId: { type: ObjectId, required: true },
  employeeId: { type: ObjectId, ref: 'EmployeeProfile', index: true },
  employerId: { type: ObjectId, ref: 'Employer' },
  raisedBy: { type: ObjectId, ref: 'User' },
  reason: { type: String, required: true },
  evidence: [{ fileId: String, name: String }],
  status: { type: String, enum: ['open', 'under_review', 'resolved_employee', 'resolved_employer', 'modified', 'rejected'], default: 'open' },
  resolution: String,
  heldDelta: { type: Number, default: 0 },
  resolvedBy: { type: ObjectId, ref: 'User' },
  resolvedAt: Date,
  slaDueAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('Dispute', schema);
