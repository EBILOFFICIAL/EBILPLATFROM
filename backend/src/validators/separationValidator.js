const Joi = require('joi');
const { SEPARATION_TYPES, REASON_CATEGORIES } = require('../constants');

const dim = Joi.number().min(0).max(100);

module.exports = {
  log: Joi.object({
    employmentRecordId: Joi.string().hex().length(24).required(), separationType: Joi.string().valid(...SEPARATION_TYPES).default('resignation'),
    reasonCategory: Joi.string().valid(...REASON_CATEGORIES).required(), resignationDate: Joi.date().required(), lastWorkingDay: Joi.date().min(Joi.ref('resignationDate')).required(),
  }),
  confirm: Joi.object({ agree: Joi.boolean().default(true), resignationDate: Joi.date(), lastWorkingDay: Joi.date() }),
  assessment: Joi.object({
    separationType: Joi.string().valid(...SEPARATION_TYPES), reasonCategory: Joi.string().valid(...REASON_CATEGORIES),
    noticeRequiredDays: Joi.number().min(0).max(365), noticeServedDays: Joi.number().min(0).max(365),
    buyoutStatus: Joi.string().valid('none', 'paid', 'waived', 'early_release', 'garden_leave'), handoverStatus: Joi.string().valid('yes', 'partial', 'no'),
    assetsReturned: Joi.boolean(), exitInterviewDone: Joi.boolean(), settlementStatus: Joi.string().valid('pending', 'completed', 'on_hold'),
    rehireEligibility: Joi.string().valid('yes', 'no', 'conditional'), conductNotes: Joi.string().max(500).allow(''),
    ratings: Joi.object({ performance: dim, professionalism: dim, reliability: dim, conduct: dim }),
    disciplinaryEvidence: Joi.array().items(Joi.object({ fileId: Joi.string(), name: Joi.string() })), comment: Joi.string().max(500).allow(''),
  }),
  respond: Joi.object({ action: Joi.string().valid('accept', 'rebut', 'dispute').required(), statement: Joi.string().max(2000).allow(''), attachments: Joi.array().items(Joi.object({ fileId: Joi.string(), name: Joi.string() })) }),
};
