const rateLimit = require('express-rate-limit');

const make = (windowMs, max, message) => rateLimit({
  windowMs, max, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => `${req.headers['cf-connecting-ip'] || req.ip}:${req.user?._id || ''}`,
  validate: { keyGeneratorIpFallback: false, trustProxy: false, xForwardedForHeader: false },
  handler: (req, res) => res.status(429).json({ success: false, message, data: null }),
});

module.exports = {
  apiLimiter: make(60 * 1000, 600, 'Too many requests. Slow down'),
  authLimiter: make(15 * 60 * 1000, 100, 'Too many authentication attempts. Try again later'),
  otpLimiter: make(10 * 60 * 1000, 20, 'Too many code requests. Try again later'),
  panLimiter: make(60 * 60 * 1000, 10, 'Too many PAN attempts from this IP. Try again in an hour'),
};
