const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  jobType: { type: String, required: true, index: true },
  trigger: { type: String, enum: ['schedule', 'manual'], default: 'schedule' },
  status: { type: String, enum: ['running', 'completed', 'failed'], default: 'running' },
  startedAt: Date,
  finishedAt: Date,
  profilesProcessed: { type: Number, default: 0 },
  changes: { type: Number, default: 0 },
  failures: { type: Number, default: 0 },
  log: [String],
  result: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

module.exports = mongoose.model('ScoreJobRun', schema);
