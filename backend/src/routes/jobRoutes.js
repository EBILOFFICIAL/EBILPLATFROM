const router = require('express').Router();
const c = require('../controllers/jobController');
const v = require('../validators/jobValidator');
const uploads = require('../middleware/uploadMiddleware');
const { validate } = require('../middleware/validateMiddleware');
const { authenticate, requireVerifiedEmail } = require('../middleware/authMiddleware');
const { requireRole, loadProfile } = require('../middleware/roleMiddleware');

router.get('/', validate(v.query, 'query'), c.list);
router.get('/:id', c.get);
router.post('/:id/apply', authenticate, requireRole('employee'), requireVerifiedEmail, loadProfile, uploads.resume(), c.apply);

module.exports = router;
