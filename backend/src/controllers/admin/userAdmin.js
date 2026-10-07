const h = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/response');
const admin = require('../../services/adminService');
const pan = require('../../services/panService');
const audit = require('../../services/auditService');
const scoreEvents = require('../../services/scoreEventService');

module.exports = {
  list: h(async (req, res) => { const r = await admin.listUsers(req.query); ok(res, r.items, 'OK', r.meta); }),
  detail: h(async (req, res) => ok(res, await admin.userDetail(req.params.id))),
  setStatus: h(async (req, res) => {
    const u = await admin.setStatus(req.params.id, req.body.status);
    await audit.log({ req, action: `user.${req.body.status}`, entityType: 'User', entityId: req.params.id, meta: { reason: req.body.reason } });
    ok(res, u, `User ${req.body.status}`);
  }),
  forceLogout: h(async (req, res) => { await admin.forceLogout(req.params.id); await audit.log({ req, action: 'user.force_logout', entityType: 'User', entityId: req.params.id }); ok(res, null, 'All sessions revoked'); }),
  forceReset: h(async (req, res) => { await admin.forcePasswordReset(req.params.id); await audit.log({ req, action: 'user.force_password_reset', entityType: 'User', entityId: req.params.id }); ok(res, null, 'Password reset forced'); }),
  impersonate: h(async (req, res) => { await audit.log({ req, action: 'user.impersonate_readonly', entityType: 'User', entityId: req.params.id }); ok(res, await admin.impersonate(req.params.id)); }),
  resetVerification: h(async (req, res) => ok(res, await pan.resetVerification(req.params.profileId, req), 'Verification reset')),
  pauseScore: h(async (req, res) => {
    const p = await admin.setScorePaused(req.params.profileId, req.body.paused);
    await audit.log({ req, action: req.body.paused ? 'score.paused' : 'score.resumed', entityType: 'EmployeeProfile', entityId: req.params.profileId });
    ok(res, p, req.body.paused ? 'Score updates paused' : 'Score updates resumed');
  }),
  recalc: h(async (req, res) => { const r = await scoreEvents.recalculate(req.params.profileId); await audit.log({ req, action: 'score.recalculated', entityType: 'EmployeeProfile', entityId: req.params.profileId, after: r }); ok(res, r, 'Recalculated from ledger'); }),
  merge: h(async (req, res) => { const r = await admin.mergeDuplicate(req.body.keepProfileId, req.body.removeProfileId); await audit.log({ req, action: 'profile.merged', entityType: 'EmployeeProfile', entityId: req.body.removeProfileId, meta: r }); ok(res, r, 'Duplicate merged'); }),
  dpdpExport: h(async (req, res) => { await audit.log({ req, action: 'dpdp.export', entityType: 'User', entityId: req.params.id }); ok(res, await admin.dpdpExport(req.params.id)); }),
  dpdpErase: h(async (req, res) => { const r = await admin.dpdpErase(req.params.id); await audit.log({ req, action: 'dpdp.erase', entityType: 'User', entityId: req.params.id }); ok(res, r, 'Erasure processed'); }),
  createAdmin: h(async (req, res) => { const u = await admin.createAdmin(req.body); await audit.log({ req, action: 'admin.created', entityType: 'User', entityId: u._id }); created(res, { id: u._id, email: u.email }, 'Admin created'); }),
};
