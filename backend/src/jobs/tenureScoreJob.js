const EmploymentRecord = require('../models/EmploymentRecord');
const score = require('../services/scoreService');
const scoreEvents = require('../services/scoreEventService');

module.exports = async () => {
  const cfg = await score.getActiveConfig();
  const records = await EmploymentRecord.find({ status: 'verified' }).populate('employerId', 'companyName').lean();
  let changes = 0;
  for (const r of records) {
    const years = ((r.endDate ? new Date(r.endDate) : new Date()) - new Date(r.startDate)) / (365.25 * 864e5);
    for (const [milestone, boost] of Object.entries(cfg.events.tenureBoosts)) {
      if (years >= Number(milestone)) {
        const ev = await scoreEvents.applyScoreEvent({ employeeId: r.employeeId, delta: boost, reason: `Tenure milestone: ${milestone} year(s) at ${r.employerId?.companyName || r.companyName}`, source: 'tenure', refType: 'employment', refId: r._id, idempotencyKey: `tenure:${r._id}:${milestone}` }).catch(() => null);
        if (ev && ev.createdAt > new Date(Date.now() - 60000)) changes += 1;
      }
    }
  }
  return { processed: records.length, changes };
};
