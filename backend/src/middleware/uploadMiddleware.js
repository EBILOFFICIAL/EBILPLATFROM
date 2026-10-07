const multer = require('multer');
const AppError = require('../utils/AppError');

const ALLOWED = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/csv'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => (ALLOWED.includes(file.mimetype) ? cb(null, true) : cb(AppError.badRequest('Unsupported file type. Allowed: PDF, PNG, JPG, WEBP, CSV'))),
});

const resume = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => (['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'].includes(file.mimetype) ? cb(null, true) : cb(AppError.badRequest('Only PDF, DOC or DOCX resumes are allowed'))),
});

module.exports = { single: (field = 'file') => upload.single(field), resume: (field = 'resume') => resume.single(field) };
