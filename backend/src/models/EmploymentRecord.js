const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;
const schema = new mongoose.Schema({
  employeeId: { type: ObjectId, ref: 'EmployeeProfile', required: true, index: true },
  employerId: { type: ObjectId, ref: 'Employer', index: true },
  companyName: String,
  designation: { type: String, required: true },
  department: String,
  startDate: { type: Date, required: true },
  endDate: Date,
  isCurrent: { type: Boolean, default: true },
  status: { type: String, enum: ['declared', 'pending_employee', 'verified', 'rejected', 'disputed'], default: 'declared' },
  source: { type: String, enum: ['employee', 'employer', 'offer'], default: 'employee' },
  exitReason: String,
  verifiedBy: { type: ObjectId, ref: 'User' },
  verifiedAt: Date,
  signatureHash: String,
  rejectionReason: String,
  verifyToken: String,
  ctcPrivate: { type: Number, select: false },
}, { timestamps: true });

module.exports = mongoose.model('EmploymentRecord', schema);
