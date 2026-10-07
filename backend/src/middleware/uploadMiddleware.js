const multer = require('multer');
const AppError = require('../utils/AppError');

const ALLOWED = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/csv'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => (ALLOWED.includes(file.mimetype) ? cb(null, true) : cb(AppError.badRequest('Unsupported file type. Allowed: PDF, PNG, JPG, WEBP, CSV'))),
});

module.exports = { single: (field = 'file') => upload.single(field) };
