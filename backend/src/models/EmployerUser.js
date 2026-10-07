const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employer', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  role: { type: String, enum: ['Owner', 'HR Manager', 'Recruiter', 'Viewer'], default: 'Owner' },
  permissions: [String],
}, { timestamps: true });

module.exports = mongoose.model('EmployerUser', schema);
