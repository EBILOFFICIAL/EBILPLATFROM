const ledger = require('../services/ledgerService');
const fraud = require('../services/fraudService');

module.exports = async () => {
  const r = await ledger.verifyIntegrity();
  if (!r.valid) await fraud.flag({ type: 'document_forensics', severity: 'critical', details: { ledgerBreaks: r.breaks.slice(0, 20) } });
  return { processed: r.entries, failures: r.breaks.length, log: r.breaks.slice(0, 50).map((b) => `seq ${b.seq}: ${b.reason}`), extra: { valid: r.valid, headHash: r.headHash } };
};
