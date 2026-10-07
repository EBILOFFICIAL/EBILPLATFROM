const router = require('express').Router();
const c = require('../controllers/publicController');
const { contact } = require('../validators/adminValidator');
const { validate } = require('../middleware/validateMiddleware');
const { otpLimiter } = require('../middleware/rateLimiter');

router.get('/cms', c.cmsList);
router.get('/cms/:slug', c.cms);
router.get('/stats', c.stats);
router.get('/plans', c.plans);
router.get('/site', c.site);
router.post('/contact', otpLimiter, validate(contact), c.contact);
router.get('/report-verify/:token', c.reportVerify);
router.post('/offer-confirm/:token', c.offerConfirm);

module.exports = router;
