const router = require('express').Router();
const { maintenance } = require('../middleware/errorMiddleware');
const pub = require('../controllers/publicController');

router.get('/health', (req, res) => res.json({ success: true, message: 'EIBIL API healthy', data: { time: new Date() } }));
router.get('/files/:id', pub.file);
router.use(maintenance);
router.use('/auth', require('./authRoutes'));
router.use('/verification', require('./verificationRoutes'));
router.use('/public', require('./publicRoutes'));
router.use('/jobs', require('./jobRoutes'));
router.use('/billing', require('./billingRoutes'));
router.use('/admin', require('./admin'));
router.use('/', require('./offerRoutes'));
router.use('/', require('./separationRoutes'));
router.use('/', require('./referenceRoutes'));
router.use('/employee', require('./employeeRoutes'));
router.use('/employer', require('./employerRoutes'));

module.exports = router;
