const audit = require('../services/auditService');

const auditAction = (action, entityType) => (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode < 400) audit.log({ req, action, entityType, entityId: req.params.id, meta: { method: req.method, path: req.originalUrl } });
  });
  next();
};

module.exports = { auditAction };
