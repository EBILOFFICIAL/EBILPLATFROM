const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');
const Employer = require('../models/Employer');
const Evaluation = require('../models/Evaluation');
const Dispute = require('../models/Dispute');
const FraudFlag = require('../models/FraudFlag');
const Payment = require('../models/Payment');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Consent = require('../models/Consent');
const { MessageLog } = require('../models/misc');

async function dashboard({ from, to } = {}) {
  const range = from || to ? { createdAt: { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to) }) } } : {};
  const [users, employees, employers, pendingEmployers, panVerified, panQueue, evaluations, openDisputes, overdueDisputes, fraudOpen, revenue, jobs, applications, panChecks, emails] = await Promise.all([
    User.countDocuments(range), EmployeeProfile.countDocuments({ ...range, isShell: false }), Employer.countDocuments(range), Employer.countDocuments({ kycStatus: 'pending' }),
    EmployeeProfile.countDocuments({ ...range, panVerified: true }), EmployeeProfile.countDocuments({ panStatus: 'pending_review' }), Evaluation.countDocuments({ ...range, status: 'accepted' }),
    Dispute.countDocuments({ status: { $in: ['open', 'under_review'] } }), Dispute.countDocuments({ status: { $in: ['open', 'under_review'] }, slaDueAt: { $lt: new Date() } }),
    FraudFlag.countDocuments({ status: 'open' }), Payment.aggregate([{ $match: { status: 'paid', ...range } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    Job.countDocuments({ status: 'active' }), Application.aggregate([{ $match: range }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Consent.countDocuments({ ...range, type: 'pan_verification' }), MessageLog.countDocuments(range),
  ]);
  const distribution = await EmployeeProfile.aggregate([{ $match: { currentScore: { $ne: null } } }, { $bucket: { groupBy: '$currentScore', boundaries: [300, 600, 750, 850, 900, 951], default: 'other', output: { count: { $sum: 1 } } } }]);
  return {
    users, employees, employers, pendingEmployers, panVerified, panQueue, evaluations, openDisputes, overdueDisputes, fraudOpen,
    revenue: revenue[0]?.total || 0, activeJobs: jobs, funnel: applications, providerCosts: { panChecks, estimatedPanCostInr: panChecks * 3, emails },
    scoreDistribution: distribution.map((d) => ({ bucket: d._id, count: d.count })),
  };
}

module.exports = { dashboard };
