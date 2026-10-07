const h = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/response');
const configs = require('../../services/scoreConfigService');
const audit = require('../../services/auditService');
const jobs = require('../../jobs');
const queue = require('../../config/queue');
const ScoreJobRun = require('../../models/ScoreJobRun');

module.exports = {
  list: h(async (req, res) => ok(res, await configs.list())),
  create: h(async (req, res) => { const c = await configs.createDraft(req.body, req.user); await audit.log({ req, action: 'score_config.draft_created', entityType: 'ScoreConfig', entityId: c._id }); created(res, c, `Draft v${c.version} created`); }),
  update: h(async (req, res) => ok(res, await configs.updateDraft(req.params.id, req.body), 'Draft updated')),
  submit: h(async (req, res) => { const c = await configs.submit(req.params.id); await audit.log({ req, action: 'score_config.submitted', entityType: 'ScoreConfig', entityId: c._id }); ok(res, c, 'Submitted for approval'); }),
  decide: h(async (req, res) => { const c = await configs.decide(req.params.id, req.user, req.body.approve); await audit.log({ req, action: `score_config.${req.body.approve ? 'activated' : 'rejected'}`, entityType: 'ScoreConfig', entityId: c._id }); ok(res, c, req.body.approve ? `v${c.version} is now active` : 'Rejected'); }),
  rollback: h(async (req, res) => { const c = await configs.rollback(Number(req.params.version), req.user); await audit.log({ req, action: 'score_config.rolled_back', entityType: 'ScoreConfig', entityId: c.config._id }); ok(res, c, `Rolled back. v${c.config.version} is now live`); }),
  preview: h(async (req, res) => ok(res, await configs.preview(req.params.id, req.query.n || 50))),
  adjustments: h(async (req, res) => ok(res, await configs.adjustments())),
  requestAdjust: h(async (req, res) => { const a = await configs.requestAdjustment(req.body, req.user); await audit.log({ req, action: 'score.adjusted', entityType: 'ScoreAdjustment', entityId: a._id, subjectEmployeeId: a.employeeId, meta: req.body }); created(res, a, 'Score adjusted instantly and recorded in the ledger'); }),
  decideAdjust: h(async (req, res) => { const a = await configs.decideAdjustment(req.params.id, req.user, req.body.approve); await audit.log({ req, action: `score.adjust_${a.status}`, entityType: 'ScoreAdjustment', entityId: a._id }); ok(res, a, `Adjustment ${a.status}`); }),
  recalculateAll: h(async (req, res) => { await queue.enqueue('job.scoreRecalc', { trigger: 'manual' }); await audit.log({ req, action: 'score.recalculate_all' }); ok(res, null, 'Full recalculation queued. Track progress in Score Jobs'); }),
  jobCatalog: h(async (req, res) => ok(res, { jobs: jobs.catalog(), queueMode: queue.getMode(), runs: await ScoreJobRun.find().sort({ createdAt: -1 }).limit(100).lean() })),
  runJob: h(async (req, res) => { const run = await jobs.runNow(req.params.name); await audit.log({ req, action: 'job.run_manual', entityType: 'ScoreJobRun', entityId: run._id, meta: { job: req.params.name } }); ok(res, run, `Job ${req.params.name} ${run.status}`); }),
};
