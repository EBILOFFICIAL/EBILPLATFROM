const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;
const dim = { type: Number, min: 0, max: 100, required: true };
const schema = new mongoose.Schema({
  employmentRecordId: { type: ObjectId, ref: 'EmploymentRecord', required: true },
  employerId: { type: ObjectId, ref: 'Employer', required: true },
  employeeId: { type: ObjectId, ref: 'EmployeeProfile', required: true },
  raterUserId: { type: ObjectId, ref: 'User' },
  period: { type: String, required: true },
  performance: dim,
  professionalism: dim,
  reliability: dim,
  conduct: dim,
  answers: [{ _id: false, questionId: ObjectId, text: String, dimension: String, type: { type: String }, weight: Number, optionIndex: Number, answer: String, points: Number }],
  composite: Number,
  comments: { type: String, maxlength: 1000 },
  status: { type: String, enum: ['draft', 'submitted', 'held', 'accepted', 'disputed', 'removed'], default: 'draft' },
  holdReason: String,
  weight: Number,
  appliedDelta: { type: Number, default: 0 },
  submittedAt: Date,
}, { timestamps: true });

schema.index({ employeeId: 1, employerId: 1, period: 1 }, { unique: true });

module.exports = mongoose.model('Evaluation', schema);
