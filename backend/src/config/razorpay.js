const env = require('./env');

const { keyId, keySecret, mode } = env.razorpay;
const live = mode === 'live' && keyId && keySecret && !keyId.includes('dummy');
let client = null;
if (live) {
  const Razorpay = require('razorpay');
  client = new Razorpay({ key_id: keyId, key_secret: keySecret });
}

module.exports = { client, isMock: !live, keyId, keySecret, webhookSecret: env.razorpay.webhookSecret };
