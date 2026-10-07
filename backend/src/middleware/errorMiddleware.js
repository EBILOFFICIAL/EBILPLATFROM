const logger = require('../config/logger');
const AppError = require('../utils/AppError');
const settings = require('../services/settingsService');

const notFound = (req, res, next) => next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let { message } = err;
  let errors = err.errors && !Array.isArray(err.errors) && err.name === 'ValidationError'
    ? Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }))
    : err.errors;
  if (err.name === 'ValidationError') status = 400;
  if (err.name === 'CastError') { status = 400; message = `Invalid ${err.path}`; errors = undefined; }
  if (err.code === 11000) { status = 409; message = `Duplicate value for ${Object.keys(err.keyPattern || {}).join(', ')}`; errors = undefined; }
  if (err.code === 'LIMIT_FILE_SIZE') { status = 400; message = 'File too large (max 5MB)'; }
  if (status >= 500) logger.error(err.stack || err.message);
  res.status(status).json({ success: false, message: status >= 500 ? 'Internal server error' : message, data: null, ...(errors ? { errors } : {}) });
}

async function maintenance(req, res, next) {
  if (!(await settings.get('maintenanceMode'))) return next();
  if (req.path.startsWith('/admin') || req.path.startsWith('/auth') || req.path.startsWith('/public')) return next();
  return res.status(503).json({ success: false, message: 'EIBIL is under scheduled maintenance. Please try again shortly', data: null });
}

module.exports = { notFound, errorHandler, maintenance };
