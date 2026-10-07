const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  separationCaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'SeparationCase', required: true, index: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeProfile', required: true },
  statement: { type: String, required: true, maxlength: 2000 },
  attachments: [{ fileId: String, name: String }],
}, { timestamps: true });

module.exports = mongoose.model('ExitRebuttal', schema);
