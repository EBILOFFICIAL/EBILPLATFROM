const h = require('../../utils/asyncHandler');
const { ok } = require('../../utils/response');
const data = require('../../services/adminDataService');
const configs = require('../../services/scoreConfigService');
const score = require('../../services/scoreService');
const questionnaire = require('../../services/questionnaireService');
const audit = require('../../services/auditService');

module.exports = {
  models: h(async (req, res) => ok(res, await data.summary())),
  list: h(async (req, res) => { const r = await data.list(req.params.model, req.query); ok(res, r.items, 'OK', r.meta); }),
  get: h(async (req, res) => ok(res, await data.get(req.params.model, req.params.id))),
  update: h(async (req, res) => ok(res, await data.update(req.params.model, req.params.id, req.body, req), 'Saved')),
  remove: h(async (req, res) => ok(res, await data.remove(req.params.model, req.params.id, req, req.query.reason), 'Deleted')),
  activity: h(async (req, res) => { const r = await data.activity(req.query, req.user); ok(res, r.items, 'OK', r.meta); }),
  algorithm: h(async (req, res) => {
    const cfg = await score.getActiveConfig();
    const questions = await questionnaire.all();
    ok(res, { config: Object.fromEntries(configs.PARAMS.concat(['version']).map((p) => [p, cfg[p]])), questions, defaults: score.DEFAULT_CONFIG });
  }),
  applyConfig: h(async (req, res) => {
    const r = await configs.applyConfig(req.body, req.user);
    await audit.log({ req, action: 'score_config.applied', entityType: 'ScoreConfig', entityId: r.config._id, before: r.before, after: Object.fromEntries(r.changed.map((p) => [p, r.config[p]])), meta: { notes: req.body.notes } });
    ok(res, r, `Algorithm v${r.config.version} is now live${r.changed.length ? ` (${r.changed.join(', ')} changed)` : ''}`);
  }),
  activate: h(async (req, res) => {
    const r = await configs.activate(req.params.id, req.user);
    await audit.log({ req, action: 'score_config.activated', entityType: 'ScoreConfig', entityId: r.config._id });
    ok(res, r, `v${r.config.version} is now live`);
  }),
};
