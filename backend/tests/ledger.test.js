const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const ledger = require('../src/services/ledgerService');
const LedgerEntry = require('../src/models/LedgerEntry');

test('ledger: hash chain verifies, blocks updates, detects tampering', async (t) => {
  await connectDB('eibil_test_ledger');
  await mongoose.connection.db.dropDatabase();
  t.after(async () => { await mongoose.connection.db.dropDatabase(); await mongoose.disconnect(); });

  for (let i = 0; i < 5; i += 1) await ledger.append({ entityType: 'test', entityId: `e${i}`, action: 'created', payload: { i } });
  const ok = await ledger.verifyIntegrity();
  assert.strictEqual(ok.valid, true);
  assert.strictEqual(ok.entries, 5);

  await assert.rejects(() => LedgerEntry.updateOne({ seq: 2 }, { payload: { i: 99 } }), /append-only/);
  await assert.rejects(() => LedgerEntry.deleteOne({ seq: 2 }), /append-only/);

  await mongoose.connection.db.collection('ledgerentries').updateOne({ seq: 3 }, { $set: { payload: { i: 1000 } } });
  const broken = await ledger.verifyIntegrity();
  assert.strictEqual(broken.valid, false);
  assert.ok(broken.breaks.some((b) => b.seq === 3));
});
