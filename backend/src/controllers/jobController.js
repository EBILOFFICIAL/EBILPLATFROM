const h = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const jobs = require('../services/jobService');

module.exports = {
  list: h(async (req, res) => { const r = await jobs.publicList(req.query); ok(res, r.items, 'OK', r.meta); }),
  get: h(async (req, res) => ok(res, await jobs.getPublic(req.params.id))),
  apply: h(async (req, res) => created(res, await jobs.apply(req.profile, req.user, req.params.id, req.body), 'Application submitted with your EIBIL profile')),
  myApplications: h(async (req, res) => ok(res, await jobs.myApplications(req.profile._id))),
  toggleSave: h(async (req, res) => ok(res, await jobs.toggleSave(req.profile, req.params.id))),
  saved: h(async (req, res) => ok(res, await jobs.savedJobs(req.profile))),
  employerJobs: h(async (req, res) => ok(res, await jobs.employerJobs(req.employer._id))),
  create: h(async (req, res) => created(res, await jobs.create(req.employer, req.user, req.body), 'Job posted')),
  update: h(async (req, res) => ok(res, await jobs.update(req.employer, req.params.id, req.body), 'Job updated')),
  remove: h(async (req, res) => ok(res, await jobs.remove(req.employer, req.params.id), 'Job closed')),
  applicants: h(async (req, res) => ok(res, await jobs.applicants(req.employer, req.params.id))),
  setStatus: h(async (req, res) => ok(res, await jobs.setStatus(req.employer, req.user, req.body.ids || req.params.id, req.body.status, req.body.note), 'Pipeline updated')),
};
