const h = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const AppError = require('../utils/AppError');
const separations = require('../services/separationService');
const exits = require('../services/exitAssessmentService');
const EmployeeProfile = require('../models/EmployeeProfile');
const EmployerUser = require('../models/EmployerUser');

module.exports = {
  employeeList: h(async (req, res) => ok(res, await separations.withAssessment({ employeeId: req.profile._id }))),
  employeeLog: h(async (req, res) => created(res, await separations.employeeLog(req.profile, req.body), 'Resignation logged. Your employer will confirm')),
  employeeRespond: h(async (req, res) => ok(res, await exits.employeeRespond(req.profile, req.params.id, req.body), 'Response recorded')),
  employerList: h(async (req, res) => ok(res, await separations.withAssessment({ employerId: req.employer._id }))),
  employerLog: h(async (req, res) => created(res, await separations.employerLog(req.employer, req.body), 'Separation logged. Employee will confirm')),
  confirm: h(async (req, res) => {
    let actor;
    if (req.user.role === 'employee') actor = { profileId: (await EmployeeProfile.findOne({ userId: req.user._id }).lean())?._id };
    else if (req.user.role === 'employer') actor = { employerId: (await EmployerUser.findOne({ userId: req.user._id }).lean())?.employerId };
    else throw AppError.forbidden();
    ok(res, await separations.confirm(req.params.id, actor, req.body), 'Case updated');
  }),
  saveAssessment: h(async (req, res) => ok(res, await exits.saveDraft(req.employer, req.params.id, req.body), 'Assessment saved')),
  submitAssessment: h(async (req, res) => ok(res, await exits.submit(req.employer, req.params.id), 'Assessment submitted. Employee review window started')),
};
