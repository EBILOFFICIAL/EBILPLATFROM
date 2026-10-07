export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const isPan = (v) => PAN_RE.test(String(v || '').toUpperCase());
export const isIndividualPan = (v) => isPan(v) && String(v).toUpperCase()[3] === 'P';
