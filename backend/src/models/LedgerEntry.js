const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  seq: { type: Number, required: true, unique: true },
  entityType: { type: String, required: true, index: true },
  entityId: { type: String, required: true, index: true },
  action: { type: String, required: true },
  subjectId: { type: String, index: true },
  payload: { type: mongoose.Schema.Types.Mixed },
  payloadHash: { type: String, required: true },
  prevHash: { type: String, required: true },
  entryHash: { type: String, required: true },
  createdAt: { type: Date, required: true },
}, { versionKey: false });

const block = function blockMutation() { throw new Error('Ledger is append-only: updates and deletes are forbidden'); };
['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndDelete', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'replaceOne'].forEach((op) => schema.pre(op, block));
schema.pre('save', function onlyNew() { if (!this.isNew) throw new Error('Ledger entries are immutable'); });

module.exports = mongoose.model('LedgerEntry', schema);
