const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const { paginate } = require('../utils/pagination');
const AuditLog = require('../models/AuditLog');

fs.readdirSync(path.join(__dirname, '../models')).forEach((f) => require(`../models/${f}`));

const EXCLUDED = ['OtpToken', 'Session'];
const READ_ONLY = ['LedgerEntry', 'AuditLog', 'ScoreEvent', 'MessageLog', 'ScoreJobRun'];
const HIDDEN = /password|encrypted|secret|^panHash$|companyPanHash|codeHash|tokenHash|refreshToken/i;
const SYSTEM = ['_id', '__v', 'createdAt', 'updatedAt'];

const models = () => Object.keys(mongoose.models).filter((m) => !EXCLUDED.includes(m)).sort();
const modelOf = (name) => {
  if (!models().includes(name)) throw AppError.notFound(`Unknown data type: ${name}`);
  return mongoose.models[name];
};

function fieldsOf(Model) {
  const out = [];
  Model.schema.eachPath((p, t) => {
    if (SYSTEM.includes(p) || HIDDEN.test(p) || p.includes('.$')) return;
    const top = p.split('.')[0];
    if (out.some((f) => f.path === top && f.type === 'Mixed')) return;
    const ref = t.options?.ref || t.caster?.options?.ref;
    out.push({ path: p, type: t.instance, ref: typeof ref === 'string' ? ref : undefined, enum: t.enumValues?.length ? t.enumValues : undefined, required: Boolean(t.isRequired) });
  });
  return out;
}

const strip = (doc) => {
  if (!doc) return doc;
  Object.keys(doc).forEach((k) => { if (HIDDEN.test(k)) delete doc[k]; });
  return doc;
};

async function summary() {
  return Promise.all(models().map(async (name) => ({ name, count: await mongoose.models[name].estimatedDocumentCount(), readOnly: READ_ONLY.includes(name) })));
}

async function list(name, query) {
  const Model = modelOf(name);
  const filter = {};
  const strings = fieldsOf(Model).filter((f) => f.type === 'String' && !f.enum).map((f) => f.path).slice(0, 6);
  if (query.q) {
    const rx = new RegExp(String(query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = strings.map((f) => ({ [f]: rx }));
    if (mongoose.isValidObjectId(query.q)) filter.$or.push({ _id: query.q });
  }
  const r = await paginate(Model, filter, query, { sort: { createdAt: -1, _id: -1 } });
  return { items: r.items.map(strip), meta: r.meta };
}

async function linked(name, id) {
  const out = [];
  for (const other of models()) {
    const refPaths = fieldsOf(mongoose.models[other]).filter((f) => f.ref === name).map((f) => f.path);
    if (!refPaths.length) continue;
    const filter = { $or: refPaths.map((p) => ({ [p]: id })) };
    const [items, total] = await Promise.all([mongoose.models[other].find(filter).sort({ createdAt: -1 }).limit(10).lean(), mongoose.models[other].countDocuments(filter)]);
    if (total) out.push({ model: other, total, items: items.map(strip) });
  }
  return out;
}

async function get(name, id) {
  const Model = modelOf(name);
  if (!mongoose.isValidObjectId(id)) throw AppError.badRequest('Invalid id');
  const doc = strip(await Model.findById(id).lean());
  if (!doc) throw AppError.notFound(`${name} not found`);
  const [history, links] = await Promise.all([
    AuditLog.find({ entityId: String(id) }).populate('actorId', 'name email role').sort({ createdAt: -1 }).limit(50).lean(),
    linked(name, id),
  ]);
  return { model: name, readOnly: READ_ONLY.includes(name), fields: fieldsOf(Model), doc, history, linked: links };
}

async function update(name, id, body, req) {
  if (READ_ONLY.includes(name)) throw AppError.forbidden(`${name} records are immutable`);
  const Model = modelOf(name);
  const doc = await Model.findById(id);
  if (!doc) throw AppError.notFound();
  const { _reason: reason, ...changes } = body || {};
  const allowed = new Set(fieldsOf(Model).map((f) => f.path.split('.')[0]));
  const before = {};
  const after = {};
  const notes = [];

  if (name === 'EmployeeProfile' && changes.currentScore !== undefined) {
    const delta = Number(changes.currentScore) - (doc.currentScore || 0);
    if (delta) {
      await require('./scoreEventService').applyScoreEvent({ employeeId: doc._id, delta, reason: `Admin override${reason ? `: ${reason}` : ''}`, source: 'admin', refType: 'admin_override', idempotencyKey: `override:${doc._id}:${Date.now()}`, force: true });
      before.currentScore = doc.currentScore; after.currentScore = Number(changes.currentScore);
      notes.push(`Score changed by ${delta > 0 ? '+' : ''}${delta} via ledger`);
    }
    delete changes.currentScore; delete changes.band;
  }
  const RATING_KEYS = ['performance', 'professionalism', 'reliability', 'conduct', 'answers'];
  if (name === 'Evaluation' && RATING_KEYS.some((k) => changes[k] !== undefined)) {
    const ratingChanges = Object.fromEntries(RATING_KEYS.filter((k) => changes[k] !== undefined).map((k) => [k, changes[k]]));
    const r = await require('./evaluationService').adminRerate(id, ratingChanges, { reason, req });
    Object.assign(before, r.before); Object.assign(after, r.after);
    notes.push(`Ratings updated; score adjusted by ${r.scoreDelta}`);
    RATING_KEYS.concat(['composite', 'appliedDelta', 'weight']).forEach((k) => delete changes[k]);
  }

  const fresh = Object.keys(changes).length ? await Model.findById(id) : null;
  Object.entries(changes).forEach(([k, v]) => {
    if (!allowed.has(k) || SYSTEM.includes(k) || HIDDEN.test(k)) return;
    before[k] = fresh.get(k);
    fresh.set(k, v === '' ? undefined : v);
    after[k] = v;
  });
  if (fresh) await fresh.save();

  if (name === 'ScoreConfig') require('./scoreService').clearConfigCache();
  if (name === 'Role') require('../middleware/permissionMiddleware').clearPermissionCache();
  if (name === 'Setting') require('./settingsService').clearCache();
  await require('./auditService').log({ req, action: `admin.data.updated`, entityType: name, entityId: id, before, after, meta: { reason, notes } });
  if (req) req._audited = true;
  return get(name, id);
}

async function remove(name, id, req, reason) {
  if (READ_ONLY.includes(name)) throw AppError.forbidden(`${name} records are immutable`);
  const doc = await modelOf(name).findByIdAndDelete(id).lean();
  if (!doc) throw AppError.notFound();
  await require('./auditService').log({ req, action: 'admin.data.deleted', entityType: name, entityId: id, before: strip(doc), meta: { reason } });
  if (req) req._audited = true;
  return { deleted: true };
}

async function activity({ mine, actorId, page, limit }, user) {
  const filter = { actorRole: 'admin' };
  if (mine === 'true' || mine === '1') filter.actorId = user._id;
  else if (actorId) filter.actorId = actorId;
  return paginate(AuditLog, filter, { page, limit }, { sort: { createdAt: -1 }, populate: { path: 'actorId', select: 'name email' } });
}

module.exports = { models, summary, list, get, update, remove, activity, READ_ONLY };
