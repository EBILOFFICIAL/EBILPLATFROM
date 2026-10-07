const router = require('express').Router();
const c = require('../controllers/referenceController');
const v = require('../validators/adminValidator');
const { validate } = require('../middleware/validateMiddleware');
const { authenticate, requireVerifiedEmail } = require('../middleware/authMiddleware');
const { requireRole, loadEmployer, requireEmployerRole } = require('../middleware/roleMiddleware');

const employer = [authenticate, requireRole('employer'), requireVerifiedEmail, loadEmployer, requireEmployerRole('Owner', 'HR Manager', 'Recruiter')];

router.get('/employer/reference-requests', employer, c.list);
router.post('/employer/reference-requests', employer, validate(v.reference), c.create);
router.post('/employer/reference-requests/:id/respond', employer, validate(v.referenceRespond), c.respond);
router.get('/support/tickets', authenticate, c.myTickets);
router.post('/support/tickets', authenticate, validate(v.ticket), c.createTicket);
router.post('/support/tickets/:id/reply', authenticate, validate(v.ticketReply), c.replyTicket);

module.exports = router;
