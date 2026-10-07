const h = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/response');
const cms = require('../../services/cmsService');
const audit = require('../../services/auditService');
const CMSPage = require('../../models/CMSPage');

module.exports = {
  list: h(async (req, res) => ok(res, await CMSPage.find(req.query.type ? { type: req.query.type } : {}).sort({ type: 1, slug: 1 }).lean())),
  get: h(async (req, res) => ok(res, await CMSPage.findOne({ slug: req.params.slug }).lean())),
  upsert: h(async (req, res) => {
    const before = await CMSPage.findOne({ slug: req.params.slug }).lean();
    const page = await cms.upsert(req.params.slug, req.body, req.user._id);
    await audit.log({ req, action: before ? 'cms.updated' : 'cms.created', entityType: 'CMSPage', entityId: req.params.slug, before: before?.content, after: page.content });
    (before ? ok : created)(res, page, 'Page saved');
  }),
  remove: h(async (req, res) => { await CMSPage.deleteOne({ slug: req.params.slug }); await audit.log({ req, action: 'cms.deleted', entityType: 'CMSPage', entityId: req.params.slug }); ok(res, null, 'Page deleted'); }),
};
