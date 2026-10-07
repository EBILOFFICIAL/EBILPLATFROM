const mongoose = require('mongoose');

const { ObjectId, Mixed } = mongoose.Schema.Types;
const schema = new mongoose.Schema({
  requesterEmployerId: { type: ObjectId, ref: 'Employer', required: true, index: true },
  employeeId: { type: ObjectId, ref: 'EmployeeProfile', required: true },
  previousEmployerId: { type: ObjectId, ref: 'Employer', required: true, index: true },
  employmentRecordId: { type: ObjectId, ref: 'EmploymentRecord' },
  consentId: { type: ObjectId, ref: 'Consent' },
  questionnaire: [String],
  response: { type: Mixed },
  autoFilled: { type: Boolean, default: false },
  status: { type: String, enum: ['pending', 'completed', 'declined', 'overdue'], default: 'pending' },
  dueAt: Date,
  respondedAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('ReferenceRequest', schema);
