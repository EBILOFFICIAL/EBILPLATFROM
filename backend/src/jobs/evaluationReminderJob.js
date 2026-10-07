const Employer = require('../models/Employer');
const EmploymentRecord = require('../models/EmploymentRecord');
const Evaluation = require('../models/Evaluation');
const EmployerUser = require('../models/EmployerUser');
const User = require('../models/User');
const queue = require('../config/queue');
const evaluation = require('../services/evaluationService');
const settings = require('../services/settingsService');
const tpl = require('../templates/email/evaluationDue');

module.exports = async () => {
  const period = evaluation.currentPeriod(await settings.get('evaluationCycle'));
  const employers = await Employer.find({ kycStatus: 'approved', status: 'active' }).lean();
  let changes = 0;
  for (const e of employers) {
    const roster = await EmploymentRecord.find({ employerId: e._id, status: 'verified', isCurrent: true }).distinct('employeeId');
    const rated = await Evaluation.find({ employerId: e._id, period }).distinct('employeeId');
    const due = roster.filter((id) => !rated.map(String).includes(String(id))).length;
    if (!due) continue;
    const owners = await EmployerUser.find({ employerId: e._id, role: { $in: ['Owner', 'HR Manager'] } }).lean();
    const users = await User.find({ _id: { $in: owners.map((o) => o.userId) } }).lean();
    for (const u of users) await queue.enqueue('email.send', { to: u.email, ...tpl({ company: e.companyName, count: due, period }) });
    changes += 1;
  }
  return { processed: employers.length, changes };
};
