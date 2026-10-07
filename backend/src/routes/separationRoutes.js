const router = require('express').Router();
const c = require('../controllers/separationController');
const v = require('../validators/separationValidator');
const { validate } = require('../middleware/validateMiddleware');
const { authenticate, requireVerifiedEmail } = require('../middleware/authMiddleware');
const { requireRole, loadProfile, loadEmployer, requireEmployerRole } = require('../middleware/roleMiddleware');

const employee = [authenticate, requireRole('employee'), requireVerifiedEmail, loadProfile];
const employer = [authenticate, requireRole('employer'), requireVerifiedEmail, loadEmployer, requireEmployerRole('Owner', 'HR Manager')];

router.get('/employee/separations', employee, c.employeeList);
router.post('/employee/separations', employee, validate(v.log), c.employeeLog);
router.post('/employee/separations/:id/respond', employee, validate(v.respond), c.employeeRespond);
router.get('/employer/separations', employer, c.employerList);
router.post('/employer/separations', employer, validate(v.log), c.employerLog);
router.put('/employer/separations/:id/assessment', employer, validate(v.assessment), c.saveAssessment);
router.post('/employer/separations/:id/submit-assessment', employer, c.submitAssessment);
router.post('/separations/:id/confirm', authenticate, requireVerifiedEmail, validate(v.confirm), c.confirm);

module.exports = router;
