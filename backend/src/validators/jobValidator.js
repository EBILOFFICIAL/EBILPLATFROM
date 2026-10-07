const Joi = require('joi');

const base = {
  title: Joi.string().min(3).max(120), description: Joi.string().min(10), location: Joi.string().allow(''),
  type: Joi.string().valid('full_time', 'part_time', 'contract', 'internship', 'remote'), role: Joi.string().allow(''),
  skills: Joi.array().items(Joi.string()), salaryMin: Joi.number().min(0), salaryMax: Joi.number().min(0),
  experienceMin: Joi.number().min(0), experienceMax: Joi.number().min(0), minEibilScore: Joi.number().min(0).max(950),
  screeningQuestions: Joi.array().items(Joi.string()).max(10), expiresAt: Joi.date(),
};

module.exports = {
  create: Joi.object({ ...base, title: base.title.required(), description: base.description.required() }),
  update: Joi.object({ ...base, status: Joi.string().valid('active', 'closed') }),
  apply: Joi.object({ answers: Joi.array().items(Joi.object({ question: Joi.string(), answer: Joi.string().allow('') })), resumeUrl: Joi.string().allow('') }),
  status: Joi.object({ status: Joi.string().valid('applied', 'shortlisted', 'interview', 'offer', 'hired', 'rejected').required(), note: Joi.string().allow(''), ids: Joi.array().items(Joi.string().hex().length(24)) }),
  query: Joi.object({ q: Joi.string().allow(''), location: Joi.string().allow(''), role: Joi.string().allow(''), type: Joi.string().allow(''), experience: Joi.number(), salary: Joi.number(), maxMinScore: Joi.number(), page: Joi.number(), limit: Joi.number() }),
};
