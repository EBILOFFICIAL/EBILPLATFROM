const crypto = require('crypto');

module.exports = (digits = 6) => String(crypto.randomInt(0, 10 ** digits)).padStart(digits, '0');
