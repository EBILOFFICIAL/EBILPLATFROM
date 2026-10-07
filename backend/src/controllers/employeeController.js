const h = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const AppError = require('../utils/AppError');
const employee = require('../services/employeeService');
const employment = require('../services/employmentService');
const scoreEvents = require('../services/scoreEventService');
const disputes = require('../services/disputeService');
const consent = require('../services/consentService');
const reports = require('../services/reportService');
const notifications = require('../services/notificationService');
const resumes = require('../services/resumeService');
const Dispute = require('../models/Dispute');
const Employer = require('../models/Employer');

const sendResume = async (resume, res) => {
  res.set({ 'Content-Type': resume.mimeType, 'Content-Disposition': `attachment; filename="${resume.fileName.replace(/"/g, '')}"`, 'Content-Length': resume.data.length });
  res.send(resume.data);
};

module.exports = {
  resume: h(async (req, res) => ok(res, await resumes.current(req.profile._id))),
  uploadResume: h(async (req, res) => {
    const r = await resumes.setCurrent(req.user, req.file);
    created(res, { id: r._id, fileName: r.fileName, size: r.size }, 'Resume uploaded. It will be attached to your applications');
  }),
  downloadResume: h(async (req, res) => {
    const current = await resumes.current(req.profile._id);
    if (!current) throw AppError.notFound('No resume uploaded');
    await sendResume(await resumes.read(current._id), res);
  }),
  deleteResume: h(async (req, res) => { await resumes.remove(req.profile); ok(res, null, 'Resume removed'); }),
  getProfile: h(async (req, res) => ok(res, req.profile)),
  updateProfile: h(async (req, res) => ok(res, await employee.updateProfile(req.user._id, req.body), 'Profile updated')),
  score: h(async (req, res) => ok(res, await employee.scoreSummary(req.profile, req.user))),
  scoreHistory: h(async (req, res) => ok(res, await scoreEvents.history(req.profile._id))),
  employments: h(async (req, res) => ok(res, await employee.timeline(req.profile._id))),
  addEmployment: h(async (req, res) => created(res, await employment.declare(req.profile, req.body), 'Employment declared. Awaiting employer verification')),
  updateEmployment: h(async (req, res) => ok(res, await employment.updateDeclared(req.profile, req.params.id, req.body), 'Updated')),
  removeEmployment: h(async (req, res) => { await employment.removeDeclared(req.profile, req.params.id); ok(res, null, 'Removed'); }),
  confirmEmployment: h(async (req, res) => ok(res, await employment.employeeConfirm(req.profile, req.user, req.params.id, req.body.accept), 'Response recorded')),
  evaluations: h(async (req, res) => ok(res, await employee.evaluations(req.profile._id))),
  raiseDispute: h(async (req, res) => created(res, await disputes.raise(req.profile, req.user, req.body), 'Dispute raised')),
  disputes: h(async (req, res) => ok(res, await Dispute.find({ employeeId: req.profile._id }).sort({ createdAt: -1 }).lean())),
  getPrivacy: h(async (req, res) => ok(res, { openToWork: req.profile.openToWork, ...req.profile.visibility.toObject() })),
  updatePrivacy: h(async (req, res) => ok(res, await employee.updatePrivacy(req.profile, req.body), 'Privacy updated')),
  consents: h(async (req, res) => ok(res, { consents: await consent.listForEmployee(req.profile._id), viewers: await reports.viewers(req.profile._id) })),
  respondConsent: h(async (req, res) => ok(res, await consent.respond(req.profile, req.params.id, req.body.approve), 'Consent updated')),
  revokeConsent: h(async (req, res) => ok(res, await consent.revoke(req.profile, req.params.id), 'Consent revoked')),
  reportPdf: h(async (req, res) => {
    await employee.scoreSummary(req.profile, req.user);
    const buf = await reports.pdf(req.profile._id);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="EIBIL-${req.profile.eibilId}.pdf"` });
    res.send(buf);
  }),
  exportData: h(async (req, res) => ok(res, await employee.exportData(req.profile, req.user))),
  requestDeletion: h(async (req, res) => { await employee.requestDeletion(req.profile); ok(res, null, 'Deletion request recorded. Our grievance officer will process it within legal retention limits'); }),
  notifications: h(async (req, res) => ok(res, await notifications.list(req.user._id, { type: req.query.type }))),
  unreadNotifications: h(async (req, res) => ok(res, { count: await notifications.unreadCount(req.user._id) })),
  readNotifications: h(async (req, res) => { await notifications.markRead(req.user._id, req.body?.id); ok(res, null); }),
  employersDirectory: h(async (req, res) => ok(res, await Employer.find({ kycStatus: 'approved' }).select('companyName city').sort({ companyName: 1 }).lean())),
};
