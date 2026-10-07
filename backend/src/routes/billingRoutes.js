const express = require('express');
const c = require('../controllers/billingController');
const v = require('../validators/adminValidator');
const { validate } = require('../middleware/validateMiddleware');
const { authenticate, requireVerifiedEmail } = require('../middleware/authMiddleware');
const { requireRole, loadEmployer, requireEmployerRole } = require('../middleware/roleMiddleware');

const router = express.Router();
const employer = [authenticate, requireRole('employer'), requireVerifiedEmail, loadEmployer, requireEmployerRole('Owner', 'HR Manager')];

router.get('/plans', c.plans);
router.post('/subscribe', employer, validate(v.order), c.subscribe);
router.post('/credits/purchase', employer, validate(v.order), c.purchaseCredits);
router.post('/verify', employer, validate(v.verifyPayment), c.verify);
router.get('/invoices', employer, c.invoices);

module.exports = router;
