const Role = require('../models/Role');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const cache = new Map();

async function permissionsFor(roleId) {
  const hit = cache.get(String(roleId));
  if (hit && Date.now() - hit.at < 30000) return hit.perms;
  const role = await Role.findById(roleId).lean();
  const perms = role?.permissions || [];
  cache.set(String(roleId), { perms, at: Date.now() });
  return perms;
}

const requirePermission = (perm) => asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') throw AppError.forbidden();
  const perms = await permissionsFor(req.user.adminRoleId);
  if (!perms.includes('*') && !perms.includes(perm)) throw AppError.forbidden(`Missing permission: ${perm}`);
  req.permissions = perms;
  next();
});

module.exports = { requirePermission, permissionsFor, clearPermissionCache: () => cache.clear() };
