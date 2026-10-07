const router = require('express').Router();
const c = require('../controllers/authController');
const v = require('../validators/authValidator');
const { validate } = require('../middleware/validateMiddleware');
const { authenticate } = require('../middleware/authMiddleware');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter');
const { registerEmployee, registerEmployer } = v;

const pickRegister = (req, res, next) => validate(req.query.role === 'employer' ? registerEmployer : registerEmployee)(req, res, next);

router.post('/register', authLimiter, pickRegister, c.register);
router.post('/login', authLimiter, validate(v.login), c.login);
router.post('/2fa/verify', authLimiter, validate(v.twoFa), c.verify2fa);
router.post('/2fa/setup', authenticate, c.setup2fa);
router.post('/refresh', c.refresh);
router.post('/logout', c.logout);
router.get('/me', authenticate, c.me);
router.post('/verify-email', otpLimiter, validate(v.verifyEmail), c.verifyEmail);
router.post('/resend-otp', otpLimiter, validate(v.resendOtp), c.resendOtp);
router.post('/forgot-password', otpLimiter, validate(v.forgot), c.forgotPassword);
router.post('/reset-password', otpLimiter, validate(v.reset), c.resetPassword);
router.post('/change-password', authenticate, validate(v.changePassword), c.changePassword);
router.get('/sessions', authenticate, c.sessions);
router.delete('/sessions', authenticate, c.revokeSessions);

module.exports = router;
