const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CIN_RE = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;

async function mock({ gstin, cin }) {
  const gstOk = gstin ? GSTIN_RE.test(gstin) : null;
  const cinOk = cin ? CIN_RE.test(cin) : null;
  return { gstinValid: gstOk, cinValid: cinOk, note: `Mock KYC: GSTIN ${gstOk === null ? 'n/a' : gstOk ? 'format valid' : 'invalid'}, CIN ${cinOk === null ? 'n/a' : cinOk ? 'format valid' : 'invalid'}` };
}

module.exports = { mock };
