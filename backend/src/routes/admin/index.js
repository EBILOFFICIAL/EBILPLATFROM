const router = require('express').Router();
const { authenticate } = require('../../middleware/authMiddleware');
const { requireRole } = require('../../middleware/roleMiddleware');
const { requirePermission: p } = require('../../middleware/permissionMiddleware');
const { validate } = require('../../middleware/validateMiddleware');
const v = require('../../validators/adminValidator');
const users = require('../../controllers/admin/userAdmin');
const employers = require('../../controllers/admin/employerAdmin');
const score = require('../../controllers/admin/scoreAdmin');
const disputes = require('../../controllers/admin/disputeAdmin');
const cms = require('../../controllers/admin/cmsAdmin');
const roles = require('../../controllers/admin/roleAdmin');
const audit = require('../../controllers/admin/auditAdmin');
const analytics = require('../../controllers/admin/analyticsAdmin');
const verification = require('../../controllers/admin/verificationAdmin');
const oversight = require('../../controllers/admin/oversightAdmin');
const system = require('../../controllers/admin/systemAdmin');

const crudRoutes = (path, ctrl, perm) => {
  router.get(path, p(perm), ctrl.list);
  router.post(path, p(perm), ctrl.create);
  router.get(`${path}/:id`, p(perm), ctrl.get);
  router.put(`${path}/:id`, p(perm), ctrl.update);
  router.delete(`${path}/:id`, p(perm), ctrl.remove);
};

router.use(authenticate, requireRole('admin'));
router.get('/analytics', p('dashboard.view'), analytics.dashboard);

router.get('/users', p('users.view'), users.list);
router.post('/users/admins', p('roles.manage'), users.createAdmin);
router.get('/users/:id', p('users.view'), users.detail);
router.post('/users/:id/status', p('users.manage'), users.setStatus);
router.post('/users/:id/force-logout', p('users.manage'), users.forceLogout);
router.post('/users/:id/force-reset', p('users.manage'), users.forceReset);
router.get('/users/:id/impersonate', p('users.view'), users.impersonate);
router.get('/users/:id/dpdp-export', p('users.manage'), users.dpdpExport);
router.post('/users/:id/dpdp-erase', p('users.manage'), users.dpdpErase);
router.post('/profiles/:profileId/reset-verification', p('verification.manage'), users.resetVerification);
router.post('/profiles/:profileId/pause-score', p('score.adjust'), users.pauseScore);
router.post('/profiles/:profileId/recalculate', p('score.adjust'), users.recalc);
router.post('/duplicates/merge', p('fraud.manage'), users.merge);

router.get('/employers', p('employers.view'), employers.list);
router.get('/employer-trust', p('employers.view'), employers.trustList);
router.post('/employer-trust/:id', p('employers.manage'), employers.trustAdjust);
router.get('/employers/:id', p('employers.view'), employers.detail);
router.post('/employers/:id/kyc', p('employers.manage'), employers.kyc);
router.put('/employers/:id', p('employers.manage'), employers.update);
router.post('/employers/:id/credits', p('billing.manage'), employers.credits);

router.get('/verification-queue', p('verification.manage'), verification.queue);
router.post('/verification-queue/bulk', p('verification.manage'), validate(v.decision), verification.decide);
router.post('/verification-queue/:id', p('verification.manage'), validate(v.decision), verification.decide);
router.get('/documents', p('verification.manage'), verification.documents);
router.post('/documents/:id', p('verification.manage'), verification.documentDecision);
router.get('/fraud', p('fraud.manage'), verification.flags);
router.get('/duplicates', p('fraud.manage'), verification.flags);
router.put('/fraud/:id', p('fraud.manage'), verification.updateFlag);
router.get('/watchlist', p('fraud.manage'), verification.watchlist);
router.post('/watchlist', p('fraud.manage'), verification.addWatch);
router.delete('/watchlist/:id', p('fraud.manage'), verification.removeWatch);

router.get('/score-config', p('score.view'), score.list);
router.post('/score-config', p('score.configure'), score.create);
router.put('/score-config/:id', p('score.configure'), score.update);
router.post('/score-config/:id/submit', p('score.configure'), score.submit);
router.post('/score-config/:id/decide', p('score.approve'), score.decide);
router.get('/score-config/:id/preview', p('score.view'), score.preview);
router.post('/score-config/rollback/:version', p('score.configure'), score.rollback);
router.get('/score/adjust', p('score.view'), score.adjustments);
router.post('/score/adjust', p('score.adjust'), validate(v.scoreAdjust), score.requestAdjust);
router.post('/score/adjust/:id/decide', p('score.approve'), score.decideAdjust);
router.post('/score/recalculate', p('score.adjust'), score.recalculateAll);
router.get('/score/jobs', p('score.view'), score.jobCatalog);
router.post('/score/jobs/:name/run', p('jobs.run'), score.runJob);

router.get('/disputes', p('disputes.manage'), disputes.list);
router.post('/disputes/:id/review', p('disputes.manage'), disputes.review);
router.post('/disputes/:id/resolve', p('disputes.manage'), validate(v.disputeResolve), disputes.resolve);
router.get('/evaluations', p('evaluations.manage'), disputes.evaluations);
router.post('/evaluations/:id/release', p('evaluations.manage'), disputes.releaseEvaluation);
router.post('/evaluations/:id/remove', p('evaluations.manage'), disputes.removeEvaluation);

router.get('/offers', p('offers.manage'), oversight.offers);
router.post('/offers/:id/verify', p('offers.manage'), oversight.verifyOffer);
router.post('/offers/process-no-shows', p('offers.manage'), oversight.runOfferJob);
router.get('/separations', p('separations.manage'), oversight.separations);
router.post('/separations/:id/resolve-dates', p('separations.manage'), oversight.resolveDates);
router.post('/separations/:id/review', p('separations.manage'), oversight.reviewSeparation);
router.post('/separations/:id/publish', p('separations.manage'), oversight.forcePublish);
router.get('/reference-requests', p('references.manage'), oversight.references);
router.get('/jobs', p('jobs.manage'), oversight.jobs);
router.put('/jobs/:id', p('jobs.manage'), oversight.moderateJob);
router.get('/applications', p('jobs.manage'), oversight.applications);

crudRoutes('/plans', system.plans, 'billing.manage');
crudRoutes('/coupons', system.coupons, 'billing.manage');
router.get('/payments', p('billing.view'), system.payments);
router.post('/payments/:id/refund', p('billing.manage'), system.refund);
router.get('/billing/gst-report', p('billing.view'), system.gstReport);

router.get('/cms', p('cms.manage'), cms.list);
router.get('/cms/:slug', p('cms.manage'), cms.get);
router.put('/cms/:slug', p('cms.manage'), cms.upsert);
router.delete('/cms/:slug', p('cms.manage'), cms.remove);

router.get('/roles', p('roles.manage'), roles.list);
router.post('/roles', p('roles.manage'), roles.create);
router.put('/roles/:id', p('roles.manage'), roles.update);
router.delete('/roles/:id', p('roles.manage'), roles.remove);
router.put('/admins/:userId/role', p('roles.manage'), roles.assign);

router.get('/audit-logs', p('audit.view'), audit.logs);
router.get('/ledger', p('audit.view'), audit.ledger);
router.get('/ledger/verify', p('ledger.verify'), audit.verifyLedger);
router.get('/consent-logs', p('audit.view'), audit.consents);
router.get('/data-access-logs', p('audit.view'), audit.dataAccess);
router.get('/message-logs', p('audit.view'), audit.messages);

router.get('/settings', p('settings.manage'), system.settings);
router.put('/settings/:key', p('settings.manage'), system.updateSetting);
router.get('/health', p('settings.manage'), system.health);
crudRoutes('/tickets', system.tickets, 'tickets.manage');
router.post('/tickets/:id/reply', p('tickets.manage'), system.replyTicket);
router.get('/broadcasts', p('broadcasts.manage'), system.broadcasts);
router.post('/broadcasts', p('broadcasts.manage'), system.sendBroadcast);

module.exports = router;
