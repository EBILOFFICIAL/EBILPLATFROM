const env = require('../config/env');
const { hmac } = require('./crypto');

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const normalizePan = (pan) => String(pan || '').trim().toUpperCase();
const isValidPan = (pan) => PAN_REGEX.test(pan);
const isIndividualPan = (pan) => isValidPan(pan) && pan[3] === 'P';
const maskPan = (pan) => `${pan.slice(0, 5)}****${pan.slice(-1)}`;
const hashPan = (pan, secret = env.panHashSecret) => hmac(normalizePan(pan), secret);

module.exports = { PAN_REGEX, normalizePan, isValidPan, isIndividualPan, maskPan, hashPan };
