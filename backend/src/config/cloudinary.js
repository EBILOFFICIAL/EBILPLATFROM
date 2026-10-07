const env = require('./env');

const c = env.cloudinary;
module.exports = {
  enabled: env.storageProvider === 'cloudinary' && Boolean(c.cloudName && c.apiKey && c.apiSecret),
  ...c,
};
