const h = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/response');
const AppError = require('../../utils/AppError');
const audit = require('../../services/auditService');
const Role = require('../../models/Role');
const User = require('../../models/User');
const { PERMISSIONS } = require('../../constants');
const { clearPermissionCache } = require('../../middleware/permissionMiddleware');

module.exports = {
  list: h(async (req, res) => ok(res, { roles: await Role.find().sort({ name: 1 }).lean(), permissions: PERMISSIONS, admins: await User.find({ role: 'admin' }).select('name email adminRoleId status lastLogin').lean() })),
  create: h(async (req, res) => { const r = await Role.create({ name: req.body.name, description: req.body.description, permissions: req.body.permissions || [] }); await audit.log({ req, action: 'role.created', entityType: 'Role', entityId: r._id, after: r.permissions }); created(res, r, 'Role created'); }),
  update: h(async (req, res) => {
    const r = await Role.findById(req.params.id);
    if (!r) throw AppError.notFound();
    if (r.system && r.name === 'Super Admin') throw AppError.forbidden('Super Admin role cannot be modified');
    const before = r.permissions;
    Object.assign(r, { permissions: req.body.permissions ?? r.permissions, description: req.body.description ?? r.description });
    await r.save();
    clearPermissionCache();
    await audit.log({ req, action: 'role.updated', entityType: 'Role', entityId: r._id, before, after: r.permissions });
    ok(res, r, 'Role updated');
  }),
  remove: h(async (req, res) => {
    const r = await Role.findById(req.params.id);
    if (!r || r.system) throw AppError.forbidden('System roles cannot be deleted');
    await r.deleteOne();
    await audit.log({ req, action: 'role.deleted', entityType: 'Role', entityId: req.params.id });
    ok(res, null, 'Role deleted');
  }),
  assign: h(async (req, res) => { const u = await User.findOneAndUpdate({ _id: req.params.userId, role: 'admin' }, { adminRoleId: req.body.adminRoleId }, { new: true }); clearPermissionCache(); await audit.log({ req, action: 'admin.role_assigned', entityType: 'User', entityId: req.params.userId }); ok(res, u, 'Role assigned'); }),
};
