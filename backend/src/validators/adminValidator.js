const Joi = require('joi');

const id = Joi.string().hex().length(24);

module.exports = {
  reference: Joi.object({ employeeId: id.required(), previousEmployerId: id.required(), questionnaire: Joi.array().items(Joi.string()) }),
  referenceRespond: Joi.object({ response: Joi.object().pattern(Joi.string(), Joi.string().allow('')).required() }),
  order: Joi.object({ planId: id.required(), couponCode: Joi.string().allow('') }),
  verifyPayment: Joi.object({ orderId: Joi.string().required(), razorpayPaymentId: Joi.string().allow(''), razorpaySignature: Joi.string().allow('') }),
  ticket: Joi.object({ subject: Joi.string().required(), category: Joi.string().allow(''), priority: Joi.string().valid('low', 'medium', 'high'), message: Joi.string().required(), email: Joi.string().email() }),
  ticketReply: Joi.object({ text: Joi.string().allow(''), internal: Joi.boolean(), status: Joi.string().valid('open', 'pending', 'resolved', 'closed') }),
  contact: Joi.object({ name: Joi.string().required(), email: Joi.string().email().required(), company: Joi.string().allow(''), message: Joi.string().min(5).required(), type: Joi.string().allow('') }),
  scoreAdjust: Joi.object({ employeeId: id.required(), delta: Joi.number().integer().min(-300).max(300).invalid(0).required(), reason: Joi.string().min(10).required() }),
  disputeResolve: Joi.object({ outcome: Joi.string().valid('employee', 'employer', 'modify', 'reject').required(), resolution: Joi.string().min(5).required(), ratings: Joi.object(), corrections: Joi.object() }),
  decision: Joi.object({ approve: Joi.boolean().required(), reason: Joi.string().allow('') }),
};
