const auth = require('./auth');
const { can, resolveAdminRole } = require('../services/admin/rbac');

const admin = (req, res, next) => {
  return auth(req, res, () => {
    if (req.user.role !== 'admin' || !resolveAdminRole(req.user)) {
      return res.status(403).json({ msg: 'Access denied. Admin role required.' });
    }
    return next();
  });
};

function requirePermission(permission) {
  return (req, res, next) => {
    if (!can(req.user, permission)) {
      return res.status(403).json({ msg: 'Insufficient admin permission' });
    }
    return next();
  };
}

module.exports = admin;
module.exports.requirePermission = requirePermission;