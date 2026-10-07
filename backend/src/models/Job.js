const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;
const schema = new mongoose.Schema({
  employerId: { type: ObjectId, ref: 'Employer', required: true, index: true },
  postedBy: { type: ObjectId, ref: 'User' },
  title: { type: String, required: true },
  description: { type: String, required: true },
  location: String,
  type: { type: String, enum: ['full_time', 'part_time', 'contract', 'internship', 'remote'], default: 'full_time' },
  role: String,
  skills: [String],
  salaryMin: Number,
  salaryMax: Number,
  experienceMin: { type: Number, default: 0 },
  experienceMax: Number,
  minEibilScore: { type: Number, default: 0 },
  screeningQuestions: [String],
  status: { type: String, enum: ['pending_approval', 'active', 'closed', 'rejected', 'taken_down'], default: 'active' },
  featured: { type: Boolean, default: false },
  moderationNote: String,
  expiresAt: Date,
  applicantsCount: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ title: 'text', description: 'text', skills: 'text' });

module.exports = mongoose.model('Job', schema);
