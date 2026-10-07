const env = require('../../config/env');

// Mock: PAN starting "XXXXX" is invalid; 5th char "Z" returns a mismatched name (sends to admin queue).
async function mock({ pan, name, dob }) {
  if (pan.startsWith('XXXXX')) return { valid: false, status: 'invalid', ref: `MOCK-${Date.now()}` };
  return { valid: true, status: 'active', nameOnPan: pan[4] === 'Z' ? 'Unmatched Holder Name' : name, dobMatch: Boolean(dob), ref: `MOCK-${Date.now()}` };
}

async function surepass({ pan, name, dob }) {
  const res = await fetch(`${env.panProviderUrl || 'https://kyc-api.surepass.io'}/api/v1/pan/pan-comprehensive`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.panProviderKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_number: pan }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) return { valid: false, status: 'invalid', ref: json?.data?.client_id };
  const d = json.data || {};
  return { valid: true, status: d.status || 'active', nameOnPan: d.full_name || name, dobMatch: !dob || !d.dob || d.dob === dob, ref: d.client_id };
}

module.exports = { mock, surepass };
