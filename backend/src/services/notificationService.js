const User = require('../models/User');
const { Notification } = require('../models/misc');
const queue = require('../config/queue');
const generic = require('../templates/email/generic');

async function notify(userId, { title, body, link, email = false }) {
  const n = await Notification.create({ userId, title, body, link });
  if (email) {
    const user = await User.findById(userId).lean();
    if (user) await queue.enqueue('email.send', { to: user.email, ...generic({ name: user.name, title, body }) });
  }
  return n;
}

async function notifyEmployer(employerId, payload) {
  const EmployerUser = require('../models/EmployerUser');
  const users = await EmployerUser.find({ employerId }).lean();
  await Promise.all(users.map((u) => notify(u.userId, payload)));
}

const list = (userId) => Notification.find({ userId }).sort({ createdAt: -1 }).limit(50).lean();
const markRead = (userId) => Notification.updateMany({ userId, read: false }, { read: true });

module.exports = { notify, notifyEmployer, list, markRead };
