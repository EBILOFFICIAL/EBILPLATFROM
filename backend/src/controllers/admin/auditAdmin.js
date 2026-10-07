const h = require('../../utils/asyncHandler');
const { ok } = require('../../utils/response');
const { paginate } = require('../../utils/pagination');
const ledger = require('../../services/ledgerService');
const audit = require('../../services/auditService');
const AuditLog = require('../../models/AuditLog');
const LedgerEntry = require('../../models/LedgerEntry');
const Consent = require('../../models/Consent');
const { MessageLog, VerificationCheck } = require('../../models/misc');

module.exports = {
  logs: h(async (req, res) => {
    const filter = {};
    if (req.query.action) filter.action = new RegExp(req.query.action, 'i');
    if (req.query.actorId) filter.actorId = req.query.actorId;
    const r = await paginate(AuditLog, filter, req.query, { populate: { path: 'actorId', select: 'name email role' } });
    ok(res, r.items, 'OK', r.meta);
  }),
  ledger: h(async (req, res) => { const r = await paginate(LedgerEntry, req.query.entityType ? { entityType: req.query.entityType } : {}, req.query, { sort: { seq: -1 } }); ok(res, r.items, 'OK', r.meta); }),
  verifyLedger: h(async (req, res) => { const r = await ledger.verifyIntegrity(); await audit.log({ req, action: 'ledger.verified', meta: { valid: r.valid, entries: r.entries } }); ok(res, r, r.valid ? 'Ledger integrity verified' : 'Ledger integrity breaks detected'); }),
  consents: h(async (req, res) => { const r = await paginate(Consent, {}, req.query, { populate: [{ path: 'employeeId', select: 'fullName eibilId' }, { path: 'requesterEmployerId', select: 'companyName' }] }); ok(res, r.items, 'OK', r.meta); }),
  dataAccess: h(async (req, res) => { const r = await paginate(VerificationCheck, {}, req.query, { select: '-snapshot', populate: [{ path: 'employeeId', select: 'fullName eibilId' }, { path: 'employerId', select: 'companyName' }] }); ok(res, r.items, 'OK', r.meta); }),
  messages: h(async (req, res) => { const r = await paginate(MessageLog, {}, req.query); ok(res, r.items, 'OK', r.meta); }),
};
