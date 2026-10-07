const EmployeeProfile = require('../models/EmployeeProfile');
const scoreEvents = require('../services/scoreEventService');

module.exports = async () => {
  const profiles = await EmployeeProfile.find({ panVerified: true, scorePaused: false }).select('_id').lean();
  let changes = 0;
  let failures = 0;
  const log = [];
  for (const p of profiles) {
    try {
      const r = await scoreEvents.recalculate(p._id);
      if (!r.match) { changes += 1; log.push(`${p._id}: ${r.storedScore} -> ${r.ledgerScore}`); }
    } catch (e) { failures += 1; log.push(`${p._id}: ${e.message}`); }
  }
  return { processed: profiles.length, changes, failures, log: log.slice(0, 100) };
};
