const jwt = require('jsonwebtoken');
const env = require('../config/env');

const signAccess = (user) => jwt.sign({ sub: String(user._id), role: user.role, type: 'access' }, env.jwtSecret, { expiresIn: env.accessTtl });
const signRefresh = (userId, jti) => jwt.sign({ sub: String(userId), jti, type: 'refresh' }, env.jwtRefreshSecret, { expiresIn: `${env.refreshTtlDays}d` });
const verifyAccess = (t) => jwt.verify(t, env.jwtSecret);
const verifyRefresh = (t) => jwt.verify(t, env.jwtRefreshSecret);
const eibilId = () => `EIB-${Math.random().toString(36).slice(2, 6).toUpperCase()}${Date.now().toString(36).slice(-4).toUpperCase()}`;

module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh, eibilId };
