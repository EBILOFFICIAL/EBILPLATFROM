const PAN_RE = /[A-Z]{5}[0-9]{4}[A-Z]/g;
const redact = (v) => String(v).replace(PAN_RE, '[PAN-REDACTED]');
const fmt = (lvl, args) => `[${new Date().toISOString()}] ${lvl} ${args.map((a) => redact(typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}`;

module.exports = {
  info: (...a) => console.log(fmt('INFO', a)),
  warn: (...a) => console.warn(fmt('WARN', a)),
  error: (...a) => console.error(fmt('ERROR', a)),
};
