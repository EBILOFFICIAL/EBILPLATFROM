const EmployerTrustMetric = require('../models/EmployerTrustMetric');
const fraud = require('./fraudService');

const ensure = (employerId) => EmployerTrustMetric.findOneAndUpdate({ employerId }, { $setOnInsert: { employerId } }, { upsert: true, new: true });

function computeIndex(m) {
  const exitRate = m.exitAssessmentsDue ? m.exitAssessmentsOnTime / m.exitAssessmentsDue : 1;
  const idx = 100 - m.acceptedWithdrawn * 10 - (m.offersWithdrawn - m.acceptedWithdrawn) * 2 - Math.round((1 - exitRate) * 20) + (m.manualAdjustment || 0);
  return Math.max(0, Math.min(100, idx));
}

async function record(employerId, inc) {
  const m = await EmployerTrustMetric.findOneAndUpdate({ employerId }, { $inc: inc }, { upsert: true, new: true });
  m.trustIndex = computeIndex(m);
  await m.save();
  if (inc.acceptedWithdrawn && m.acceptedWithdrawn >= 3) await fraud.flag({ type: 'repeated_withdrawals', severity: 'medium', employerId, details: { acceptedWithdrawn: m.acceptedWithdrawn } });
  return m;
}

async function adjust(employerId, manualAdjustment) {
  const m = await ensure(employerId);
  m.manualAdjustment = manualAdjustment;
  m.trustIndex = computeIndex(m);
  return m.save();
}

module.exports = { ensure, record, adjust, computeIndex, get: ensure };
