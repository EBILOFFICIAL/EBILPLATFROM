const router = require('express').Router();
const c = require('../controllers/verificationController');
const { verifyPan } = require('../validators/panValidator');
const { code } = require('../validators/authValidator');
const { validate } = require('../middleware/validateMiddleware');
const { authenticate, requireVerifiedEmail } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { panLimiter, otpLimiter } = require('../middleware/rateLimiter');
const upload = require('../middleware/uploadMiddleware');

router.use(authenticate);
router.get('/status', c.status);
router.post('/pan', requireRole('employee'), requireVerifiedEmail, panLimiter, validate(verifyPan), c.pan);
router.post('/documents', requireVerifiedEmail, upload.single('file'), c.documents);
router.post('/mobile/send', otpLimiter, c.mobileSend);
router.post('/mobile/verify', otpLimiter, validate(code), c.mobileVerify);

module.exports = router;
