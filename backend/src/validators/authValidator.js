const Joi = require('joi');

const password = Joi.string().min(8).max(72).pattern(/[A-Za-z]/).pattern(/[0-9]/).message('Password must be 8+ characters with letters and numbers');
const email = Joi.string().email().lowercase().trim().required();
const mobile = Joi.string().pattern(/^\+?[0-9]{10,13}$/).message('Enter a valid mobile number');

module.exports = {
  registerEmployee: Joi.object({ name: Joi.string().min(2).max(80).required(), email, mobile: mobile.required(), password: password.required() }),
  registerEmployer: Joi.object({
    companyName: Joi.string().min(2).required(), cin: Joi.string().uppercase().allow(''), gstin: Joi.string().uppercase().allow(''),
    email, password: password.required(), hrContactName: Joi.string().required(), phone: mobile.required(), industry: Joi.string().allow(''), city: Joi.string().allow(''),
  }).or('cin', 'gstin'),
  login: Joi.object({ email, password: Joi.string().required(), portal: Joi.string().valid('employee', 'employer', 'admin') }),
  verifyEmail: Joi.object({ email, code: Joi.string().length(6).required() }),
  resendOtp: Joi.object({ email, purpose: Joi.string().valid('email_verify', 'login_2fa', 'password_reset').default('email_verify') }),
  forgot: Joi.object({ email }),
  reset: Joi.object({ email, code: Joi.string().length(6).required(), password: password.required() }),
  changePassword: Joi.object({ currentPassword: Joi.string().required(), password: password.required() }),
  code: Joi.object({ code: Joi.string().length(6).required() }),
  twoFa: Joi.object({ email, code: Joi.string().length(6).required() }),
};
