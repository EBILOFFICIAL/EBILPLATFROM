const mongoose = require('mongoose');

const { Mixed, ObjectId } = mongoose.Schema.Types;
const schema = new mongoose.Schema({
  version: { type: Number, required: true, unique: true },
  status: { type: String, enum: ['draft', 'pending_approval', 'active', 'archived', 'rejected'], default: 'draft' },
  notes: String,
  baseline: { type: Number, default: 890 },
  min: { type: Number, default: 300 },
  max: { type: Number, default: 950 },
  bands: { type: Mixed },
  weights: { type: Mixed },
  sensitivityK: { type: Number, default: 0.6 },
  neutralComposite: { type: Number, default: 75 },
  cycleCap: { type: Number, default: 25 },
  recencyHalfLifeMonths: { type: Number, default: 24 },
  trustTierWeights: { type: Mixed },
  exitRules: { type: Mixed },
  events: { type: Mixed },
  createdBy: { type: ObjectId, ref: 'User' },
  approvedBy: { type: ObjectId, ref: 'User' },
  activatedAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('ScoreConfig', schema);
