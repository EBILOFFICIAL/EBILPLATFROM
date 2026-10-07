const Joi = require('joi');

module.exports = {
  issue: Joi.object({
    candidate: Joi.string().required(), designation: Joi.string().required(), department: Joi.string().allow(''), location: Joi.string().allow(''),
    offerDate: Joi.date(), validUntil: Joi.date().required(), expectedJoiningDate: Joi.date().required(),
  }),
  selfDeclare: Joi.object({
    employerId: Joi.string().hex().length(24).allow(null, ''), companyName: Joi.string().required(), designation: Joi.string().required(),
    department: Joi.string().allow(''), location: Joi.string().allow(''), offerDate: Joi.date(), validUntil: Joi.date(), expectedJoiningDate: Joi.date(),
    ctc: Joi.number().min(0), accepted: Joi.boolean().default(false),
  }),
  accept: Joi.object({ code: Joi.string().length(6).required() }),
  withdraw: Joi.object({ reason: Joi.string().min(5).required() }),
  dispute: Joi.object({ reason: Joi.string().min(10).required() }),
};
