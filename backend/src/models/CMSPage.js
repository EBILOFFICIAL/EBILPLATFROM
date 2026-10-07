const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  title: String,
  type: { type: String, enum: ['page', 'block', 'legal', 'email_template', 'blog'], default: 'page' },
  content: { type: mongoose.Schema.Types.Mixed, default: {} },
  seo: { title: String, description: String },
  published: { type: Boolean, default: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('CMSPage', schema);
