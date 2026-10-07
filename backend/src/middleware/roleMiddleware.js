const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const employerService = require('../services/employerService');
const EmployeeProfile = require('../models/EmployeeProfile');

const requireRole = (...roles) => (req, res, next) => (roles.includes(req.user?.role) ? next() : next(AppError.forbidden('Insufficient role')));

const loadEmployer = asyncHandler(async (req, res, next) => {
  const { employer, membership } = await employerService.context(req.user._id);
  if (employer.status !== 'active') throw AppError.forbidden('Employer account suspended');
  req.employer = employer;
  req.membership = membership;
  next();
});

const requireEmployerRole = (...roles) => (req, res, next) => (roles.includes(req.membership?.role) ? next() : next(AppError.forbidden('Your team role cannot perform this action')));

const loadProfile = asyncHandler(async (req, res, next) => {
  const profile = await EmployeeProfile.findOne({ userId: req.user._id });
  if (!profile) throw AppError.notFound('Profile not found');
  req.profile = profile;
  next();
});

module.exports = { requireRole, loadEmployer, requireEmployerRole, loadProfile };
