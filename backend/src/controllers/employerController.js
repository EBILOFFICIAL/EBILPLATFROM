const h = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const AppError = require('../utils/AppError');
const employer = require('../services/employerService');
const employment = require('../services/employmentService');
const evaluation = require('../services/evaluationService');
const consent = require('../services/consentService');
const reports = require('../services/reportService');
const Evaluation = require('../models/Evaluation');
const AuditLog = require('../models/AuditLog');

module.exports = {
  downloadResume: h(async (req, res) => {
    const resumes = require('../services/resumeService');
    if (!(await resumes.employerCanRead(req.employer._id, req.params.id))) throw AppError.forbidden('You can download a resume only for your applicants or candidates whose report you have viewed');
    const resume = await resumes.read(req.params.id);
    const inline = req.query.inline === '1' && resume.mimeType === 'application/pdf';
    res.set({ 'Content-Type': resume.mimeType, 'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${resume.fileName.replace(/"/g, '')}"`, 'Content-Length': resume.data.length });
    res.send(resume.data);
  }),
  exportApplicants: h(async (req, res) => {
    const { job, applicants } = await require('../services/jobService').applicants(req.employer, req.params.id);
    const esc = (v) => { const t = String(v ?? ''); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const rows = [['Name', 'EIBIL ID', 'Email', 'Phone', 'City', 'Score at apply', 'Band', 'Status', 'Applied on', 'Resume']];
    applicants.forEach((a) => rows.push([a.employeeId?.fullName, a.employeeId?.eibilId, a.employeeId?.email, a.employeeId?.phone, a.employeeId?.city, a.scoreAtApply, a.bandAtApply, a.status, new Date(a.createdAt).toLocaleString('en-IN'), a.resumeId?.fileName || '']));
    const csv = `﻿${rows.map((r) => r.map(esc).join(',')).join('\n')}`;
    await require('../services/auditService').log({ req, action: 'applicants.exported', entityType: 'Job', entityId: job._id, meta: { count: applicants.length } });
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${job.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')}-applicants.csv"` });
    res.send(csv);
  }),
  profile: h(async (req, res) => ok(res, { employer: req.employer, membership: req.membership })),
  updateProfile: h(async (req, res) => ok(res, await employer.updateProfile(req.employer, req.body), 'Company profile updated')),
  dashboard: h(async (req, res) => ok(res, await employer.dashboard(req.employer))),
  verifyCandidate: h(async (req, res) => {
    created(res, await reports.lookupForEmployer(req.employer, req.user, req.body.query, req), 'Report generated. The candidate has been notified');
  }),
  bulkVerify: h(async (req, res) => {
    const rows = String(req.file?.buffer || '').split(/\r?\n/).map((l) => l.split(',')[0].trim()).filter(Boolean).slice(0, 200);
    const results = [];
    for (const query of rows) {
      try { const r = await reports.lookupForEmployer(req.employer, req.user, query, req); results.push({ query, status: 'viewed', reportId: r._id, score: r.snapshot.score.value, name: r.snapshot.identity.fullName }); } catch (e) { results.push({ query, status: 'error', message: e.message }); }
    }
    ok(res, results, `Processed ${results.length} rows`);
  }),
  consentOtp: h(async (req, res) => ok(res, await consent.verifyOtp(req.employer, req.params.id, req.body.code), 'Consent granted via OTP')),
  consents: h(async (req, res) => ok(res, await consent.listForEmployer(req.employer._id))),
  generateReport: h(async (req, res) => created(res, await reports.generateForEmployer(req.employer, req.user, req.body.employeeId, req), 'Report generated')),
  reports: h(async (req, res) => ok(res, await reports.listForEmployer(req.employer._id))),
  questionnaire: h(async (req, res) => ok(res, await require('../services/questionnaireService').active())),
  getReport: h(async (req, res) => ok(res, await reports.getForEmployer(req.employer, req.params.id, req))),
  employees: h(async (req, res) => ok(res, await employer.roster(req.employer, req.query.status))),
  addEmployee: h(async (req, res) => created(res, await employment.employerAdd(req.employer, req.user, req.body), 'Employee added')),
  verifyEmployment: h(async (req, res) => ok(res, await employment.employerDecision(req.employer, req.user, req.params.id, req.body), 'Employment updated')),
  evaluations: h(async (req, res) => ok(res, await Evaluation.find({ employerId: req.employer._id }).populate('employeeId', 'fullName eibilId').sort({ createdAt: -1 }).lean())),
  createEvaluation: h(async (req, res) => created(res, await evaluation.create(req.employer, req.user, req.body), req.body.submit ? 'Evaluation submitted' : 'Draft saved')),
  updateEvaluation: h(async (req, res) => ok(res, await evaluation.update(req.employer, req.params.id, req.body), 'Evaluation updated')),
  deleteEvaluation: h(async (req, res) => {
    await Evaluation.deleteOne({ _id: req.params.id, employerId: req.employer._id, status: 'draft' });
    ok(res, null, 'Draft deleted');
  }),
  talent: h(async (req, res) => ok(res, await employer.talent(req.employer, req.query))),
  team: h(async (req, res) => ok(res, await employer.team(req.employer))),
  invite: h(async (req, res) => created(res, await employer.invite(req.employer, req.body), 'Invitation sent')),
  updateMember: h(async (req, res) => ok(res, await employer.updateMember(req.employer, req.params.id, req.body), 'Role updated')),
  removeMember: h(async (req, res) => { await employer.removeMember(req.employer, req.params.id); ok(res, null, 'Member removed'); }),
  usage: h(async (req, res) => ok(res, await employer.usage(req.employer))),
  auditTrail: h(async (req, res) => {
    const members = (await employer.team(req.employer)).map((m) => m.userId?._id);
    ok(res, await AuditLog.find({ actorId: { $in: members } }).sort({ createdAt: -1 }).limit(100).lean());
  }),
};
