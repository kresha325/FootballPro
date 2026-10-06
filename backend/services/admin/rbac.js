'use strict';

/** Admin permission tiers. A null adminRole on an existing admin stays super_admin. */

const ROLES = ['super_admin', 'admin', 'moderator', 'support'];

const PERMISSIONS = {
  super_admin: ['*'],
  admin: [
    'dashboard.read',
    'search',
    'users.read',
    'users.suspend',
    'users.verify',
    'users.sessions',
    'users.premium',
    'players.read',
    'players.manage',
    'clubs.read',
    'clubs.manage',
    'competitions.manage',
    'matches.manage',
    'matches.correct',
    'scouting.read',
    'media.manage',
    'marketplace.manage',
    'orders.manage',
    'finance.read',
    'payments.read',
    'notifications.manage',
    'reports.manage',
    'content.manage',
    'analytics.read',
    'system.read',
    'jobs.read',
    'jobs.retry',
    'errors.read',
    'flags.manage',
    'maintenance.manage',
    'audit.read',
    'export.ops',
    'export.finance',
    'bulk.ops',
  ],
  moderator: [
    'dashboard.read',
    'search',
    'users.read',
    'users.suspend',
    'users.verify',
    'players.read',
    'players.manage',
    'clubs.read',
    'media.manage',
    'reports.manage',
    'content.manage',
    'scouting.read',
    'audit.read',
    'errors.read',
    'notifications.read',
  ],
  support: [
    'dashboard.read',
    'search',
    'users.read',
    'marketplace.read',
    'orders.manage',
    'payments.read',
    'notifications.read',
    'reports.read',
    'audit.read',
  ],
};

function resolveAdminRole(user) {
  if (!user || String(user.role || '').toLowerCase() !== 'admin') return null;
  const raw = user.adminRole == null || String(user.adminRole).trim() === ''
    ? 'super_admin'
    : String(user.adminRole).trim().toLowerCase();
  return ROLES.includes(raw) ? raw : null;
}

function can(user, permission) {
  const role = resolveAdminRole(user);
  if (!role || !permission) return false;
  const granted = PERMISSIONS[role] || [];
  if (granted.includes('*') || granted.includes(permission)) return true;
  const [resource, action] = String(permission).split('.');
  if (action === 'read' && granted.includes(`${resource}.manage`)) return true;
  return false;
}

function permissionList(user) {
  const role = resolveAdminRole(user);
  if (!role) return [];
  if (role === 'super_admin') return ['*'];
  return [...(PERMISSIONS[role] || [])];
}

module.exports = {
  ROLES,
  PERMISSIONS,
  resolveAdminRole,
  can,
  permissionList,
};
