const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;
const schema = new mongoose.Schema({
  type: { type: String, required: true, index: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  employeeId: { type: ObjectId, ref: 'EmployeeProfile' },
  employerId: { type: ObjectId, ref: 'Employer' },
  userId: { type: ObjectId, ref: 'User' },
  details: { type: mongoose.Schema.Types.Mixed },
  ip: String,
  status: { type: String, enum: ['open', 'investigating', 'resolved', 'dismissed'], default: 'open' },
  resolutionNote: String,
  resolvedBy: { type: ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('FraudFlag', schema);
