const SeparationCase = require('../models/SeparationCase');
const EmploymentRecord = require('../models/EmploymentRecord');
const EmployeeProfile = require('../models/EmployeeProfile');
const ExitAssessment = require('../models/ExitAssessment');
const AppError = require('../utils/AppError');
const ledger = require('./ledgerService');
const notify = require('./notificationService');
const score = require('./scoreService');

const OPEN = ['awaiting_confirmation', 'date_conflict', 'notice_running', 'assessment_pending', 'review_window', 'admin_review'];

async function open(record, initiatedBy, data) {
  if (!record || record.status !== 'verified') throw AppError.badRequest('Separation can only be logged for verified employment');
  if (await SeparationCase.exists({ employmentRecordId: record._id, status: { $in: OPEN } })) throw AppError.conflict('A separation case is already open for this employment');
  const sc = await SeparationCase.create({
    employmentRecordId: record._id, employeeId: record.employeeId, employerId: record.employerId, initiatedBy,
    separationType: data.separationType || 'resignation', reasonCategory: data.reasonCategory,
    resignationDate: data.resignationDate || new Date(), lastWorkingDay: data.lastWorkingDay,
  });
  await ledger.append({ entityType: 'separation', entityId: sc._id, action: 'logged', subjectId: sc.employeeId, payload: { initiatedBy, separationType: sc.separationType, resignationDate: sc.resignationDate, lastWorkingDay: sc.lastWorkingDay } });
  return sc;
}

async function employeeLog(profile, data) {
  const record = await EmploymentRecord.findOne({ _id: data.employmentRecordId, employeeId: profile._id });
  const sc = await open(record, 'employee', data);
  if (sc.employerId) await notify.notifyEmployer(sc.employerId, { title: 'Resignation logged', body: `${profile.fullName} logged a resignation. Please confirm dates`, link: '/employer/separations' });
  return sc;
}

async function employerLog(employer, data) {
  const record = await EmploymentRecord.findOne({ _id: data.employmentRecordId, employerId: employer._id });
  const sc = await open(record, 'employer', data);
  const p = await EmployeeProfile.findById(sc.employeeId).lean();
  if (p?.userId) await notify.notify(p.userId, { title: 'Separation logged by employer', body: `${employer.companyName} logged a ${sc.separationType.replace(/_/g, ' ')}. Please confirm dates`, link: '/employee/exit', email: true });
  return sc;
}

async function confirm(caseId, actor, { agree = true, resignationDate, lastWorkingDay }) {
  const sc = await SeparationCase.findById(caseId);
  if (!sc || sc.status !== 'awaiting_confirmation') throw AppError.badRequest('Case is not awaiting confirmation');
  const side = actor.employerId ? 'employer' : 'employee';
  const owns = side === 'employer' ? String(sc.employerId) === String(actor.employerId) : String(sc.employeeId) === String(actor.profileId);
  if (!owns) throw AppError.forbidden();
  if (side === sc.initiatedBy) throw AppError.badRequest('The other party must confirm this case');
  if (!agree) {
    sc.status = 'date_conflict';
    sc.proposedDates = { resignationDate, lastWorkingDay };
  } else {
    const cfg = await score.getActiveConfig();
    sc.status = sc.lastWorkingDay && sc.lastWorkingDay <= new Date() ? 'assessment_pending' : 'notice_running';
    sc.assessmentDueAt = new Date(new Date(sc.lastWorkingDay || Date.now()).getTime() + cfg.events.exitSubmissionDays * 864e5);
    await EmploymentRecord.updateOne({ _id: sc.employmentRecordId }, { endDate: sc.lastWorkingDay, isCurrent: false, exitReason: sc.separationType });
  }
  await sc.save();
  await ledger.append({ entityType: 'separation', entityId: sc._id, action: agree ? 'confirmed' : 'date_conflict', subjectId: sc.employeeId, payload: { by: side, proposedDates: sc.proposedDates } });
  return sc;
}

async function resolveDates(caseId, { resignationDate, lastWorkingDay }) {
  const sc = await SeparationCase.findById(caseId);
  if (!sc || sc.status !== 'date_conflict') throw AppError.badRequest('Case has no date conflict');
  const cfg = await score.getActiveConfig();
  Object.assign(sc, { resignationDate, lastWorkingDay, status: new Date(lastWorkingDay) <= new Date() ? 'assessment_pending' : 'notice_running', assessmentDueAt: new Date(new Date(lastWorkingDay).getTime() + cfg.events.exitSubmissionDays * 864e5) });
  await sc.save();
  await EmploymentRecord.updateOne({ _id: sc.employmentRecordId }, { endDate: lastWorkingDay, isCurrent: false, exitReason: sc.separationType });
  await ledger.append({ entityType: 'separation', entityId: sc._id, action: 'dates_resolved_by_admin', subjectId: sc.employeeId, payload: { resignationDate, lastWorkingDay } });
  return sc;
}

async function withAssessment(filter) {
  const cases = await SeparationCase.find(filter).populate('employerId', 'companyName').populate('employeeId', 'fullName eibilId').populate('employmentRecordId', 'designation').sort({ createdAt: -1 }).lean();
  const assessments = await ExitAssessment.find({ separationCaseId: { $in: cases.map((c) => c._id) } }).lean();
  const rebuttals = await require('../models/ExitRebuttal').find({ separationCaseId: { $in: cases.map((c) => c._id) } }).lean();
  return cases.map((c) => ({ ...c, assessment: assessments.find((a) => String(a.separationCaseId) === String(c._id)) || null, rebuttals: rebuttals.filter((r) => String(r.separationCaseId) === String(c._id)) }));
}

module.exports = { OPEN, employeeLog, employerLog, confirm, resolveDates, withAssessment };
