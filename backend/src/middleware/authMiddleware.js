const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyAccess } = require('../utils/generateToken');

const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw AppError.unauthorized();
  let payload;
  try { payload = verifyAccess(token); } catch { throw AppError.unauthorized('Session expired'); }
  const user = await User.findById(payload.sub);
  if (!user) throw AppError.unauthorized('User not found');
  if (user.status !== 'active') throw AppError.forbidden(`Account ${user.status}`);
  req.user = user;
  next();
});

const requireVerifiedEmail = (req, res, next) => (req.user.emailVerified ? next() : next(AppError.forbidden('Email verification required')));

module.exports = { authenticate, requireVerifiedEmail };
