const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fileName: { type: String, required: true, maxlength: 200 },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  sha256: { type: String, required: true },
  data: { type: Buffer, required: true, select: false },
}, { timestamps: true });

module.exports = mongoose.model('Resume', schema);
