const h = require('../../utils/asyncHandler');
const { ok } = require('../../utils/response');
const disputes = require('../../services/disputeService');
const evaluation = require('../../services/evaluationService');
const audit = require('../../services/auditService');
const { paginate } = require('../../utils/pagination');
const Dispute = require('../../models/Dispute');
const Evaluation = require('../../models/Evaluation');

module.exports = {
  list: h(async (req, res) => {
    const r = await paginate(Dispute, req.query.status ? { status: req.query.status } : {}, req.query, { populate: [{ path: 'employeeId', select: 'fullName eibilId' }, { path: 'employerId', select: 'companyName' }] });
    ok(res, r.items, 'OK', r.meta);
  }),
  resolve: h(async (req, res) => { const d = await disputes.resolve(req.params.id, req.user, req.body); await audit.log({ req, action: 'dispute.resolved', entityType: 'Dispute', entityId: d._id, after: { status: d.status } }); ok(res, d, 'Dispute resolved'); }),
  review: h(async (req, res) => ok(res, await Dispute.findByIdAndUpdate(req.params.id, { status: 'under_review' }, { new: true }), 'Marked under review')),
  evaluations: h(async (req, res) => {
    const r = await paginate(Evaluation, req.query.status ? { status: req.query.status } : {}, req.query, { populate: [{ path: 'employeeId', select: 'fullName eibilId' }, { path: 'employerId', select: 'companyName' }] });
    ok(res, r.items, 'OK', r.meta);
  }),
  releaseEvaluation: h(async (req, res) => { const e = await evaluation.release(req.params.id); await audit.log({ req, action: 'evaluation.released', entityType: 'Evaluation', entityId: e._id }); ok(res, e, 'Evaluation released and applied'); }),
  removeEvaluation: h(async (req, res) => { const e = await evaluation.remove(req.params.id, req.body.reason || 'Removed by admin'); await audit.log({ req, action: 'evaluation.removed', entityType: 'Evaluation', entityId: e._id }); ok(res, e, 'Evaluation removed via compensating entry'); }),
};
