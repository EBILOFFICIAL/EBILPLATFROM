const Joi = require('joi');

module.exports = {
  verifyPan: Joi.object({
    pan: Joi.string().trim().uppercase().length(10).required(),
    name: Joi.string().min(2).max(100).required(),
    dob: Joi.date().max('now').required(),
    consent: Joi.boolean().valid(true).required().messages({ 'any.only': 'Consent is required' }),
  }),
};
