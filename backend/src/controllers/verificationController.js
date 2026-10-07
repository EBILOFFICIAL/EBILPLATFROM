const h = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const pan = require('../services/panService');
const auth = require('../services/authService');
const upload = require('../services/uploadService');
const EmployeeProfile = require('../models/EmployeeProfile');

module.exports = {
  pan: h(async (req, res) => ok(res, await pan.verifyPan(req.user, req.body, req), 'PAN submitted')),
  status: h(async (req, res) => {
    const p = await EmployeeProfile.findOne({ userId: req.user._id }).lean();
    ok(res, { emailVerified: req.user.emailVerified, mobileVerified: req.user.mobileVerified, panStatus: p?.panStatus, panVerified: p?.panVerified, panMasked: p?.panMasked, panLockedUntil: p?.panLockedUntil });
  }),
  documents: h(async (req, res) => {
    const doc = await upload.save(req.file, { ownerId: req.user._id, purpose: req.body.purpose || 'verification' });
    created(res, { id: doc._id, name: doc.name, sha256: doc.sha256, url: upload.signedUrl(doc._id) }, 'Document uploaded');
  }),
  mobileSend: h(async (req, res) => ok(res, await auth.sendMobileOtp(req.user), 'Code sent to your mobile')),
  mobileVerify: h(async (req, res) => { await auth.verifyMobile(req.user, req.body.code); ok(res, null, 'Mobile verified'); }),
};
