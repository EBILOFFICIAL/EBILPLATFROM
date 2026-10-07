const router = require('express').Router();
const c = require('../controllers/offerController');
const v = require('../validators/offerValidator');
const { validate } = require('../middleware/validateMiddleware');
const { authenticate, requireVerifiedEmail } = require('../middleware/authMiddleware');
const { requireRole, loadProfile, loadEmployer, requireEmployerRole } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

const employee = [authenticate, requireRole('employee'), requireVerifiedEmail, loadProfile];
const employer = [authenticate, requireRole('employer'), requireVerifiedEmail, loadEmployer, requireEmployerRole('Owner', 'HR Manager', 'Recruiter')];

router.get('/employee/offers', employee, c.employeeList);
router.post('/employee/offers', employee, validate(v.selfDeclare), c.selfDeclare);
router.post('/employee/offers/:id/accept-otp', employee, c.requestOtp);
router.post('/employee/offers/:id/accept', employee, validate(v.accept), c.accept);
router.post('/employee/offers/:id/decline', employee, c.decline);
router.post('/employee/offers/:id/dispute', employee, validate(v.dispute), c.dispute);

router.get('/employer/offers', employer, c.employerList);
router.post('/employer/offers', employer, upload.single('file'), validate(v.issue), c.issue);
router.get('/employer/offers/:id', employer, c.employerGet);
router.patch('/employer/offers/:id', employer, c.employerPatch);
router.post('/employer/offers/:id/confirm-join', employer, c.confirmJoin);
router.post('/employer/offers/:id/mark-no-show', employer, c.noShow);
router.post('/employer/offers/:id/withdraw', employer, validate(v.withdraw), c.withdraw);
router.get('/employer/candidates/:id/offer-status', employer, c.candidateOfferStatus);

module.exports = router;
