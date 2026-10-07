const LedgerEntry = require('../models/LedgerEntry');
const { sha256, stableStringify } = require('../utils/crypto');

const GENESIS = 'GENESIS';
let chain = Promise.resolve();

const computeEntryHash = (e) => sha256(`${e.seq}|${e.entityType}|${e.entityId}|${e.action}|${e.payloadHash}|${e.prevHash}|${new Date(e.createdAt).toISOString()}`);

async function writeEntry({ entityType, entityId, action, subjectId, payload }) {
  const last = await LedgerEntry.findOne().sort({ seq: -1 }).lean();
  const clean = JSON.parse(JSON.stringify(payload || {}));
  const entry = {
    seq: last ? last.seq + 1 : 1,
    entityType,
    entityId: String(entityId),
    action,
    subjectId: subjectId ? String(subjectId) : undefined,
    payload: clean,
    payloadHash: sha256(stableStringify(clean)),
    prevHash: last ? last.entryHash : GENESIS,
    createdAt: new Date(),
  };
  entry.entryHash = computeEntryHash(entry);
  return LedgerEntry.create(entry);
}

function append(data) {
  const result = chain.then(() => writeEntry(data));
  chain = result.catch(() => {});
  return result;
}

async function verifyIntegrity() {
  const breaks = [];
  let prev = GENESIS;
  let expectedSeq = 1;
  let count = 0;
  const cursor = LedgerEntry.find().sort({ seq: 1 }).lean().cursor();
  for await (const e of cursor) {
    count += 1;
    if (e.seq !== expectedSeq) breaks.push({ seq: e.seq, reason: `Sequence gap: expected ${expectedSeq}` });
    if (e.prevHash !== prev) breaks.push({ seq: e.seq, reason: 'prevHash does not match previous entry' });
    if (sha256(stableStringify(e.payload)) !== e.payloadHash) breaks.push({ seq: e.seq, reason: 'Payload hash mismatch (payload altered)' });
    if (computeEntryHash(e) !== e.entryHash) breaks.push({ seq: e.seq, reason: 'Entry hash mismatch' });
    prev = e.entryHash;
    expectedSeq = e.seq + 1;
  }
  return { valid: breaks.length === 0, entries: count, breaks, headHash: prev, checkedAt: new Date() };
}

const entriesFor = (subjectId, entityType) => LedgerEntry.find({ subjectId: String(subjectId), ...(entityType ? { entityType } : {}) }).sort({ seq: 1 }).lean();

module.exports = { append, verifyIntegrity, entriesFor, computeEntryHash, GENESIS };
