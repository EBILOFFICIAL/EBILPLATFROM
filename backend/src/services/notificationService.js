const User = require('../models/User');
const { Notification } = require('../models/misc');
const queue = require('../config/queue');
const generic = require('../templates/email/generic');

async function notify(userId, { title, body, link, email = false, type = 'general', meta, emailContent }) {
  const n = await Notification.create({ userId, title, body, link, type, meta });
  if (email) {
    const user = await User.findById(userId).lean();
    if (user) await queue.enqueue('email.send', { to: user.email, ...(emailContent ? emailContent(user) : generic({ name: user.name, title, body })) });
  }
  return n;
}

async function notifyEmployer(employerId, payload) {
  const EmployerUser = require('../models/EmployerUser');
  const users = await EmployerUser.find({ employerId }).lean();
  await Promise.all(users.map((u) => notify(u.userId, payload)));
}

const list = (userId, { type } = {}) => Notification.find({ userId, ...(type ? { type } : {}) }).sort({ createdAt: -1 }).limit(50).lean();
const unreadCount = (userId) => Notification.countDocuments({ userId, read: false });
const markRead = (userId, id) => Notification.updateMany({ userId, read: false, ...(id ? { _id: id } : {}) }, { read: true });

module.exports = { notify, notifyEmployer, list, unreadCount, markRead };
