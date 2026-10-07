const Joi = require('joi');

const dim = Joi.number().integer().min(0).max(100);

module.exports = {
  create: Joi.object({
    employmentRecordId: Joi.string().hex().length(24).required(), period: Joi.string().pattern(/^\d{4}-(Q[1-4]|H[12])$/),
    performance: dim.required(), professionalism: dim.required(), reliability: dim.required(), conduct: dim.required(),
    comments: Joi.string().max(1000).allow(''), submit: Joi.boolean().default(false),
  }),
  update: Joi.object({ performance: dim, professionalism: dim, reliability: dim, conduct: dim, comments: Joi.string().max(1000).allow(''), submit: Joi.boolean() }),
};
