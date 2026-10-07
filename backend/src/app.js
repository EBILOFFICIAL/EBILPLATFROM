const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const routes = require('./routes');
const billingController = require('./controllers/billingController');
const { apiLimiter } = require('./middleware/rateLimiter');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();
app.set('trust proxy', true);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: (origin, cb) => cb(null, !origin || env.corsOrigins.includes(origin) || env.corsOrigins.includes('*')), credentials: true }));
app.post('/api/v1/billing/webhook/razorpay', express.raw({ type: '*/*' }), billingController.webhook);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/api/v1', apiLimiter, routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
