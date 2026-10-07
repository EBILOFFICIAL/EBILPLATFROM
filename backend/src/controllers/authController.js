const h = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const env = require('../config/env');
const auth = require('../services/authService');

const COOKIE = 'eibil_rt';
const cookieOpts = { httpOnly: true, secure: true, sameSite: 'none', path: '/api/v1/auth', maxAge: env.refreshTtlDays * 864e5 };
const meta = (req) => ({ ip: req.ip, userAgent: req.headers['user-agent'] });

function sendTokens(res, result, message) {
  res.cookie(COOKIE, result.refreshToken, cookieOpts);
  return ok(res, { accessToken: result.accessToken, user: result.user }, message);
}

module.exports = {
  register: h(async (req, res) => {
    const { role = 'employee' } = req.query;
    const result = role === 'employer' ? await auth.registerEmployer(req.body, req.ip) : await auth.registerEmployee(req.body, req.ip);
    created(res, result, 'Account created. Enter the code sent to your email');
  }),
  login: h(async (req, res) => {
    const result = await auth.login(req.body, meta(req));
    if (result.twoFactorRequired) return ok(res, result, 'Enter the sign-in code sent to your email');
    return sendTokens(res, result, 'Signed in');
  }),
  verify2fa: h(async (req, res) => sendTokens(res, await auth.verify2fa(req.body, meta(req)), 'Signed in')),
  refresh: h(async (req, res) => sendTokens(res, await auth.refresh(req.cookies[COOKIE], meta(req)), 'Refreshed')),
  logout: h(async (req, res) => {
    await auth.logout(req.cookies[COOKIE]);
    res.clearCookie(COOKIE, { ...cookieOpts, maxAge: undefined });
    ok(res, null, 'Signed out');
  }),
  me: h(async (req, res) => ok(res, await auth.me(req.user))),
  verifyEmail: h(async (req, res) => ok(res, await auth.verifyEmail(req.body), 'Email verified')),
  resendOtp: h(async (req, res) => ok(res, await auth.resendOtp(req.body), 'Code sent')),
  forgotPassword: h(async (req, res) => ok(res, await auth.forgotPassword(req.body), 'If the account exists, a reset code was sent')),
  resetPassword: h(async (req, res) => { await auth.resetPassword(req.body); ok(res, null, 'Password updated. Please sign in'); }),
  changePassword: h(async (req, res) => { await auth.changePassword(req.user._id, req.body); ok(res, null, 'Password changed'); }),
  setup2fa: h(async (req, res) => { await auth.toggle2fa(req.user._id, req.body.enabled !== false); ok(res, { enabled: req.body.enabled !== false }, 'Two-factor setting updated'); }),
  sessions: h(async (req, res) => ok(res, await auth.sessions(req.user._id))),
  revokeSessions: h(async (req, res) => { await auth.revokeSessions(req.user._id); ok(res, null, 'All sessions signed out'); }),
};
