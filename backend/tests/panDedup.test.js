const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const User = require('../src/models/User');
const EmployeeProfile = require('../src/models/EmployeeProfile');
const pan = require('../src/services/panService');
const { hashPan, maskPan, isIndividualPan } = require('../src/utils/panUtils');

const req = { ip: '127.0.0.1', headers: {} };
const mkUser = async (n) => {
  const u = await User.create({ role: 'employee', name: `User ${n}`, email: `u${n}@t.in`, emailVerified: true, passwordHash: 'x' });
  await EmployeeProfile.create({ userId: u._id, eibilId: `EIB-T${n}`, fullName: `User ${n}` });
  return u;
};

test('PAN utils: format, masking, deterministic HMAC', () => {
  assert.ok(isIndividualPan('ABCPE1234F'));
  assert.ok(!isIndividualPan('ABCCE1234F'));
  assert.strictEqual(maskPan('ABCPE1234F'), 'ABCPE****F');
  assert.strictEqual(hashPan('abcpe1234f'), hashPan('ABCPE1234F'));
});

test('PAN de-duplication: second profile with same PAN is rejected', async (t) => {
  await connectDB('eibil_test_pan');
  await mongoose.connection.db.dropDatabase();
  await EmployeeProfile.syncIndexes();
  t.after(async () => { await mongoose.connection.db.dropDatabase(); await mongoose.disconnect(); });

  const a = await mkUser(1);
  const b = await mkUser(2);
  const r = await pan.verifyPan(a, { pan: 'ABCPE1234F', name: 'User 1', dob: '1990-01-01', consent: true }, req);
  assert.strictEqual(r.panStatus, 'verified');
  assert.strictEqual(r.panMasked, 'ABCPE****F');
  const stored = await EmployeeProfile.findOne({ userId: a._id }).select('+panEncrypted').lean();
  assert.ok(!stored.panEncrypted.includes('ABCPE1234F'));
  assert.strictEqual(stored.currentScore, 890);

  await assert.rejects(() => pan.verifyPan(b, { pan: 'abcpe1234f', name: 'User 2', dob: '1990-01-01', consent: true }, req), /already linked/);
  await assert.rejects(() => EmployeeProfile.updateOne({ userId: b._id }, { panHash: hashPan('ABCPE1234F') }), /duplicate key/i);
});
