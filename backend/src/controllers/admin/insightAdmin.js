const h = require('../../utils/asyncHandler');
const { ok } = require('../../utils/response');
const insight = require('../../services/adminInsightService');
const audit = require('../../services/auditService');

module.exports = {
  employees: h(async (req, res) => { const r = await insight.listEmployees(req.query); ok(res, r.items, 'OK', r.meta); }),
  employee: h(async (req, res) => ok(res, await insight.employeeOverview(req.params.id))),
  employer: h(async (req, res) => ok(res, await insight.employerOverview(req.params.id))),
  applications: h(async (req, res) => { const r = await insight.listApplications(req.query); ok(res, r.items, 'OK', r.meta); }),
  applicationStatus: h(async (req, res) => {
    const { app, before } = await insight.setApplicationStatus(req.params.id, req.body.status, req.user, req.body.note);
    await audit.log({ req, action: 'application.status_changed', entityType: 'Application', entityId: app._id, subjectEmployeeId: app.employeeId, before: { status: before }, after: { status: app.status }, meta: { note: req.body.note } });
    ok(res, app, `Application moved to ${app.status}`);
  }),
};
