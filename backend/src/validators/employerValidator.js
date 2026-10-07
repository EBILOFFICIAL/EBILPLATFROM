const Joi = require('joi');

const id = Joi.string().hex().length(24);

module.exports = {
  profile: Joi.object({ companyName: Joi.string(), industry: Joi.string().allow(''), city: Joi.string().allow(''), hrContactName: Joi.string(), phone: Joi.string() }),
  verifyCandidate: Joi.object({ query: Joi.string().required(), purpose: Joi.string().max(200).allow(''), mode: Joi.string().valid('on_demand', 'otp').default('on_demand') }),
  consentOtp: Joi.object({ code: Joi.string().length(6).required() }),
  generateReport: Joi.object({ employeeId: id.required() }),
  addEmployee: Joi.object({
    pan: Joi.string().uppercase().length(10).required(), fullName: Joi.string().required(), designation: Joi.string().required(),
    department: Joi.string().allow(''), startDate: Joi.date().required(), endDate: Joi.date().allow(null),
  }),
  verifyEmployment: Joi.object({
    action: Joi.string().valid('approve', 'reject', 'correct').required(), reason: Joi.string().when('action', { is: 'reject', then: Joi.required() }),
    startDate: Joi.date(), endDate: Joi.date().allow(null), designation: Joi.string(),
  }),
  invite: Joi.object({ name: Joi.string().required(), email: Joi.string().email().required(), role: Joi.string().valid('HR Manager', 'Recruiter', 'Viewer').required() }),
  memberRole: Joi.object({ role: Joi.string().valid('HR Manager', 'Recruiter', 'Viewer').required() }),
};
