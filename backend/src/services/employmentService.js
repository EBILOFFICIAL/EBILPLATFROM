const EmploymentRecord = require('../models/EmploymentRecord');
const EmployeeProfile = require('../models/EmployeeProfile');
const Employer = require('../models/Employer');
const AppError = require('../utils/AppError');
const { sha256, stableStringify, randomToken, encrypt } = require('../utils/crypto');
const { eibilId } = require('../utils/generateToken');
const { normalizePan, isIndividualPan, hashPan, maskPan } = require('../utils/panUtils');
const ledger = require('./ledgerService');
const fraud = require('./fraudService');
const notify = require('./notificationService');

async function seal(record, user, action = 'verified') {
  record.status = 'verified';
  record.verifiedBy = user._id;
  record.verifiedAt = new Date();
  const payload = { recordId: record._id, employeeId: record.employeeId, employerId: record.employerId, designation: record.designation, startDate: record.startDate, endDate: record.endDate, verifiedBy: user._id, at: record.verifiedAt };
  record.signatureHash = sha256(stableStringify(JSON.parse(JSON.stringify(payload))));
  await record.save();
  await ledger.append({ entityType: 'employment_record', entityId: record._id, action, subjectId: record.employeeId, payload: { ...payload, signatureHash: record.signatureHash } });
  await fraud.checkOverlap(record);
  return record;
}

async function declare(profile, data) {
  const employer = data.employerId ? await Employer.findById(data.employerId).lean() : null;
  const record = await EmploymentRecord.create({
    ...data, employeeId: profile._id, employerId: employer?._id, companyName: employer?.companyName || data.companyName,
    isCurrent: !data.endDate, status: 'declared', source: 'employee', verifyToken: randomToken(16),
  });
  if (employer) await notify.notifyEmployer(employer._id, { title: 'Employment verification requested', body: `${profile.fullName} declared employment as ${record.designation}`, link: '/employer/employees' });
  return record;
}

async function updateDeclared(profile, id, data) {
  const record = await EmploymentRecord.findOne({ _id: id, employeeId: profile._id });
  if (!record) throw AppError.notFound();
  if (record.status !== 'declared') throw AppError.forbidden('Verified history cannot be edited. Raise a dispute for corrections');
  Object.assign(record, data, { isCurrent: !data.endDate });
  return record.save();
}

async function removeDeclared(profile, id) {
  const record = await EmploymentRecord.findOne({ _id: id, employeeId: profile._id });
  if (!record) throw AppError.notFound();
  if (record.status !== 'declared') throw AppError.forbidden('Verified history cannot be deleted');
  await record.deleteOne();
}

async function employerDecision(employer, user, id, { action, startDate, endDate, designation, reason }) {
  const record = await EmploymentRecord.findOne({ _id: id, employerId: employer._id });
  if (!record) throw AppError.notFound('Employment record not found for your company');
  if (record.status === 'verified') throw AppError.conflict('Record already verified and sealed');
  if (action === 'reject') {
    record.status = 'rejected';
    record.rejectionReason = reason;
    await record.save();
    await ledger.append({ entityType: 'employment_record', entityId: record._id, action: 'rejected', subjectId: record.employeeId, payload: { reason, by: user._id } });
  } else {
    if (action === 'correct') Object.assign(record, { ...(startDate && { startDate }), ...(endDate && { endDate, isCurrent: false }), ...(designation && { designation }) });
    await seal(record, user, action === 'correct' ? 'verified_with_correction' : 'verified');
  }
  const profile = await EmployeeProfile.findById(record.employeeId).lean();
  if (profile?.userId) await notify.notify(profile.userId, { title: `Employment ${record.status}`, body: `${employer.companyName} ${record.status} your ${record.designation} record`, link: '/employee/employment', email: true });
  return record;
}

async function employerAdd(employer, user, { pan, fullName, designation, department, startDate, endDate }) {
  const normalized = normalizePan(pan);
  if (!isIndividualPan(normalized)) throw AppError.badRequest('A valid individual PAN is required');
  const panHash = hashPan(normalized);
  let profile = await EmployeeProfile.findOne({ panHash });
  if (!profile) {
    profile = await EmployeeProfile.create({ eibilId: eibilId(), fullName, panHash, panEncrypted: encrypt(normalized), panMasked: maskPan(normalized), isShell: true, panStatus: 'not_submitted' });
  }
  const record = await EmploymentRecord.create({ employeeId: profile._id, employerId: employer._id, companyName: employer.companyName, designation, department, startDate, endDate, isCurrent: !endDate, status: 'pending_employee', source: 'employer' });
  if (profile.userId) await notify.notify(profile.userId, { title: 'Confirm employment record', body: `${employer.companyName} added you as ${designation}. Please confirm.`, link: '/employee/employment', email: true });
  return { record, shellCreated: profile.isShell, eibilId: profile.eibilId };
}

async function employeeConfirm(profile, user, id, accept) {
  const record = await EmploymentRecord.findOne({ _id: id, employeeId: profile._id, status: 'pending_employee' });
  if (!record) throw AppError.notFound();
  if (!accept) {
    record.status = 'disputed';
    await record.save();
    return record;
  }
  return seal(record, user, 'verified_by_employer_confirmed');
}

module.exports = { seal, declare, updateDeclared, removeDeclared, employerDecision, employerAdd, employeeConfirm };
