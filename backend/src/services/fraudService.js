const FraudFlag = require('../models/FraudFlag');
const Evaluation = require('../models/Evaluation');
const EmploymentRecord = require('../models/EmploymentRecord');

const flag = (data) => FraudFlag.create(data);

async function ratingOutlier(employerId, composite, stdDevs) {
  const rows = await Evaluation.find({ employerId, status: { $in: ['accepted', 'held'] } }).select('composite').lean();
  const globalRows = await Evaluation.aggregate([{ $match: { status: 'accepted' } }, { $group: { _id: null, avg: { $avg: '$composite' }, sd: { $stdDevPop: '$composite' } } }]);
  if (rows.length < 3 || !globalRows.length || !globalRows[0].sd) return false;
  const employerAvg = rows.reduce((a, r) => a + r.composite, 0) / rows.length;
  const { avg, sd } = globalRows[0];
  return Math.abs(employerAvg - avg) > stdDevs * sd && Math.abs(composite - avg) > stdDevs * sd;
}

async function checkOverlap(record) {
  const overlap = await EmploymentRecord.findOne({
    _id: { $ne: record._id },
    employeeId: record.employeeId,
    status: 'verified',
    startDate: { $lt: record.endDate || new Date() },
    $or: [{ endDate: null }, { endDate: { $gt: record.startDate } }],
  }).lean();
  if (overlap) await flag({ type: 'overlapping_employment', severity: 'medium', employeeId: record.employeeId, details: { recordA: record._id, recordB: overlap._id } });
  return Boolean(overlap);
}

module.exports = { flag, ratingOutlier, checkOverlap };
