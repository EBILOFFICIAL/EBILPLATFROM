const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  actorRole: String,
  action: { type: String, required: true, index: true },
  entityType: String,
  entityId: String,
  before: mongoose.Schema.Types.Mixed,
  after: mongoose.Schema.Types.Mixed,
  meta: mongoose.Schema.Types.Mixed,
  subjectEmployeeId: { type: mongoose.Schema.Types.ObjectId, index: true },
  ip: String,
  userAgent: String,
}, { timestamps: { createdAt: true, updatedAt: false } });

const block = () => { throw new Error('Audit log is immutable'); };
['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete'].forEach((op) => schema.pre(op, block));

module.exports = mongoose.model('AuditLog', schema);
