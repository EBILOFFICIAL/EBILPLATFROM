const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;
const schema = new mongoose.Schema({
  ticketNo: { type: String, unique: true },
  userId: { type: ObjectId, ref: 'User' },
  email: String,
  subject: { type: String, required: true },
  category: { type: String, default: 'general' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  status: { type: String, enum: ['open', 'pending', 'resolved', 'closed'], default: 'open' },
  messages: [{ from: String, by: ObjectId, text: String, internal: Boolean, at: Date }],
  assignedTo: { type: ObjectId, ref: 'User' },
  slaDueAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('Ticket', schema);
