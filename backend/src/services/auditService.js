const AuditLog = require('../models/AuditLog');
const logger = require('../config/logger');

async function log({ req, actor, action, entityType, entityId, before, after, meta, subjectEmployeeId }) {
  const user = actor || req?.user;
  try {
    return await AuditLog.create({
      actorId: user?._id,
      actorRole: user?.role,
      action,
      entityType,
      entityId: entityId ? String(entityId) : undefined,
      before,
      after,
      meta,
      subjectEmployeeId,
      ip: req?.ip,
      userAgent: req?.headers?.['user-agent'],
    });
  } catch (err) {
    logger.error(`Audit log failed: ${err.message}`);
    return null;
  }
}

module.exports = { log };
