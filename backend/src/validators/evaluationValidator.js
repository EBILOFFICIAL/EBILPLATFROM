const Joi = require('joi');

const dim = Joi.number().integer().min(0).max(100);
const answers = Joi.array().items(Joi.object({ questionId: Joi.string().hex().length(24).required(), optionIndex: Joi.number().integer().min(0).required() })).max(100);

module.exports = {
  create: Joi.object({
    employmentRecordId: Joi.string().hex().length(24).required(), period: Joi.string().pattern(/^\d{4}-(Q[1-4]|H[12])$/),
    answers,
    performance: dim, professionalism: dim, reliability: dim, conduct: dim,
    comments: Joi.string().max(1000).allow(''), submit: Joi.boolean().default(false),
  }).or('answers', 'performance'),
  update: Joi.object({ answers, performance: dim, professionalism: dim, reliability: dim, conduct: dim, comments: Joi.string().max(1000).allow(''), submit: Joi.boolean() }),
};
