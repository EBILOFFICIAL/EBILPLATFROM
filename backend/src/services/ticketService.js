const Ticket = require('../models/Ticket');
const AppError = require('../utils/AppError');

async function create(user, { subject, category, priority, message, email }) {
  const count = await Ticket.countDocuments();
  return Ticket.create({ ticketNo: `TCK-${String(count + 1).padStart(5, '0')}`, userId: user?._id, email: email || user?.email, subject, category, priority, slaDueAt: new Date(Date.now() + 2 * 864e5), messages: [{ from: 'user', by: user?._id, text: message, at: new Date() }] });
}

async function reply(ticketId, actor, { text, internal = false, status }, asAdmin) {
  const t = await Ticket.findById(ticketId);
  if (!t) throw AppError.notFound();
  if (!asAdmin && String(t.userId) !== String(actor._id)) throw AppError.forbidden();
  if (text) t.messages.push({ from: asAdmin ? 'support' : 'user', by: actor._id, text, internal: asAdmin && internal, at: new Date() });
  if (status && asAdmin) t.status = status;
  return t.save();
}

async function mine(userId) {
  const rows = await Ticket.find({ userId }).sort({ createdAt: -1 }).lean();
  return rows.map((t) => ({ ...t, messages: t.messages.filter((m) => !m.internal) }));
}

module.exports = { create, reply, mine };
