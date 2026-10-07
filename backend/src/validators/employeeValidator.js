const Joi = require('joi');

const id = Joi.string().hex().length(24);

module.exports = {
  id,
  profile: Joi.object({
    fullName: Joi.string().max(100), photo: Joi.string().uri().allow(''), location: Joi.string().allow(''), headline: Joi.string().max(140).allow(''),
    experienceYears: Joi.number().min(0).max(60), skills: Joi.array().items(Joi.string().max(40)).max(30), resumeUrl: Joi.string().allow(''),
    education: Joi.array().items(Joi.object({ institution: Joi.string(), degree: Joi.string(), year: Joi.number() })),
  }),
  employment: Joi.object({
    employerId: id.allow(null, ''), companyName: Joi.string().when('employerId', { is: Joi.valid(null, ''), then: Joi.required() }),
    designation: Joi.string().required(), department: Joi.string().allow(''), startDate: Joi.date().required(), endDate: Joi.date().min(Joi.ref('startDate')).allow(null),
  }),
  privacy: Joi.object({
    openToWork: Joi.boolean(), showExactScore: Joi.boolean(), allowCurrentEmployerOfferView: Joi.boolean(),
    hideFromEmployerIds: Joi.array().items(id), hideOfferStatusFromEmployerIds: Joi.array().items(id),
  }),
  dispute: Joi.object({
    targetType: Joi.string().valid('evaluation', 'employment', 'offer', 'separation', 'score_event').required(), targetId: id.required(),
    reason: Joi.string().min(10).max(2000).required(), evidence: Joi.array().items(Joi.object({ fileId: Joi.string(), name: Joi.string() })),
  }),
  consentRespond: Joi.object({ approve: Joi.boolean().required() }),
  confirmEmployment: Joi.object({ accept: Joi.boolean().required() }),
};
