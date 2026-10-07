const ReferenceRequest = require('../models/ReferenceRequest');
const EmploymentRecord = require('../models/EmploymentRecord');
const SeparationCase = require('../models/SeparationCase');
const ExitAssessment = require('../models/ExitAssessment');
const Evaluation = require('../models/Evaluation');
const AppError = require('../utils/AppError');
const consent = require('./consentService');
const notify = require('./notificationService');

const QUESTIONS = ['Employment dates', 'Notice period served', 'Overall performance', 'Eligible for rehire', 'Conduct'];

async function autoResponse(record) {
  const sc = await SeparationCase.findOne({ employmentRecordId: record._id, status: 'published' }).lean();
  if (!sc) return null;
  const a = await ExitAssessment.findOne({ separationCaseId: sc._id }).lean();
  const evals = await Evaluation.find({ employmentRecordId: record._id, status: 'accepted' }).lean();
  const perf = evals.length ? Math.round(evals.reduce((s, e) => s + e.performance, 0) / evals.length) : a?.ratings?.performance;
  return {
    'Employment dates': `${new Date(record.startDate).toDateString()} - ${record.endDate ? new Date(record.endDate).toDateString() : 'Present'}`,
    'Notice period served': `${a.noticeServedDays}/${a.noticeRequiredDays} days (${a.buyoutStatus})`,
    'Overall performance': perf != null ? `${perf}/100` : 'Not rated',
    'Eligible for rehire': a.rehireEligibility,
    Conduct: a.ratings?.conduct != null ? `${a.ratings.conduct}/100` : 'Not rated',
  };
}

async function create(employer, user, { employeeId, previousEmployerId, questionnaire }) {
  const grant = await consent.activeConsent(employer._id, employeeId);
  if (!grant) throw AppError.forbidden('Candidate consent is required for reference checks');
  const record = await EmploymentRecord.findOne({ employeeId, employerId: previousEmployerId, status: 'verified' }).sort({ startDate: -1 });
  if (!record) throw AppError.notFound('No verified employment with that previous employer');
  const response = await autoResponse(record);
  const rr = await ReferenceRequest.create({
    requesterEmployerId: employer._id, employeeId, previousEmployerId, employmentRecordId: record._id, consentId: grant._id,
    questionnaire: questionnaire?.length ? questionnaire : QUESTIONS, response, autoFilled: Boolean(response),
    status: response ? 'completed' : 'pending', respondedAt: response ? new Date() : undefined, dueAt: new Date(Date.now() + 3 * 864e5),
  });
  if (!response) await notify.notifyEmployer(previousEmployerId, { title: 'Reference request received', body: `${employer.companyName} requested a reference. Response target: 3 days`, link: '/employer/references' });
  return rr;
}

async function respond(employer, id, response) {
  const rr = await ReferenceRequest.findOne({ _id: id, previousEmployerId: employer._id, status: { $in: ['pending', 'overdue'] } });
  if (!rr) throw AppError.notFound('Pending reference request not found');
  Object.assign(rr, { response, status: 'completed', respondedAt: new Date() });
  await rr.save();
  await notify.notifyEmployer(rr.requesterEmployerId, { title: 'Reference received', body: 'A previous employer responded to your reference request', link: '/employer/references' });
  return rr;
}

const pop = (q) => q.populate('requesterEmployerId', 'companyName').populate('previousEmployerId', 'companyName').populate('employeeId', 'fullName eibilId').sort({ createdAt: -1 }).lean();
const list = (employerId) => Promise.all([pop(ReferenceRequest.find({ requesterEmployerId: employerId })), pop(ReferenceRequest.find({ previousEmployerId: employerId }))]).then(([outgoing, incoming]) => ({ outgoing, incoming }));
const markOverdue = () => ReferenceRequest.updateMany({ status: 'pending', dueAt: { $lt: new Date() } }, { status: 'overdue' });

module.exports = { QUESTIONS, create, respond, list, markOverdue };
