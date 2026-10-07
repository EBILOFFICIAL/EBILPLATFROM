const EmployeeProfile = require('../models/EmployeeProfile');
const { decrypt } = require('../utils/crypto');
const pan = require('../services/panService');
const fraud = require('../services/fraudService');

module.exports = async () => {
  const yearAgo = new Date(Date.now() - 365 * 864e5);
  const due = await EmployeeProfile.find({ panVerified: true, panVerifiedAt: { $lt: yearAgo } }).select('+panEncrypted');
  let changes = 0;
  for (const p of due) {
    const r = await pan.provider()({ pan: decrypt(p.panEncrypted), name: p.fullName, dob: p.dob });
    if (!r.valid) {
      p.scoreFrozen = true;
      p.panStatus = 'invalid';
      await fraud.flag({ type: 'watchlist_hit', severity: 'high', employeeId: p._id, details: { reason: 'Annual PAN re-check failed; score frozen' } });
      changes += 1;
    } else p.panVerifiedAt = new Date();
    await p.save();
  }
  return { processed: due.length, changes };
};
