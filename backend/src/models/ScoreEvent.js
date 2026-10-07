const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;
const schema = new mongoose.Schema({
  employeeId: { type: ObjectId, ref: 'EmployeeProfile', required: true, index: true },
  oldScore: Number,
  newScore: Number,
  delta: Number,
  reason: String,
  source: { type: String, enum: ['baseline', 'evaluation', 'exit', 'offer', 'penalty', 'boost', 'admin', 'recalc', 'dispute', 'decay', 'tenure'] },
  refType: String,
  refId: ObjectId,
  evaluationId: { type: ObjectId, ref: 'Evaluation' },
  configVersion: Number,
  negative: { type: Boolean, default: false },
  neverDecay: { type: Boolean, default: false },
  decayed: { type: Boolean, default: false },
  idempotencyKey: { type: String, unique: true, sparse: true },
  ledgerSeq: Number,
}, { timestamps: true });

module.exports = mongoose.model('ScoreEvent', schema);
