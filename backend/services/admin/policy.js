'use strict';

const DIRECT_BALANCE_KEYS = ['balance', 'joncoinBalance', 'newBalance', 'setBalance'];

const FEATURE_FLAGS = ['LIVE_STREAMING', 'MARKETPLACE', 'JONCOIN', 'PREMIUM', 'SCOUTING', 'ANALYTICS'];

const OPEN_REPORT_STATUSES = ['pending', 'reviewed', 'in_review'];

const REPORT_STATUS_ALIAS = {
  open: 'pending',
  pending: 'pending',
  in_review: 'in_review',
  reviewed: 'reviewed',
  resolved: 'resolved',
  actioned: 'actioned',
  rejected: 'rejected',
  dismissed: 'dismissed',
};

const EXPORTS = {
  users: ['id', 'email', 'firstName', 'lastName', 'role', 'verified', 'adminVerified', 'bannedAt', 'createdAt', 'lastSeenAt'],
  players: ['id', 'email', 'firstName', 'lastName', 'verified', 'clubVerified', 'bannedAt', 'createdAt', 'lastSeenAt'],
  orders: ['id', 'userId', 'sellerId', 'status', 'currency', 'totalAmount', 'createdAt'],
  transactions: ['id', 'userId', 'type', 'amount', 'currency', 'status', 'balanceBefore', 'balanceAfter', 'createdAt'],
  reports: ['id', 'reporterId', 'targetType', 'targetId', 'reason', 'status', 'createdAt'],
  analytics: ['day', 'newUsers', 'newOrders'],
};

const SECRET_FIELD = /password|token|secret|streamkey|rtmp|apikey|apisecret|clientsecret|authorization|connectionstring/i;

function requireReason(reason) {
  const text = String(reason || '').trim();
  if (text.length < 3 || text.length > 500) {
    const err = new Error('A reason between 3 and 500 characters is required');
    err.status = 400;
    throw err;
  }
  return text;
}

function rejectDirectBalanceEdit(body) {
  if (!body || typeof body !== 'object') return null;
  for (const key of DIRECT_BALANCE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(body, key) && body[key] != null && body[key] !== '') {
      return 'Direct balance edits are not allowed. Create an adjustment transaction.';
    }
  }
  return null;
}

function pageParams(query = {}) {
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  return { limit, page, offset: (page - 1) * limit };
}

function maintenanceDecision({ maintenance, user, path = '' }) {
  if (!maintenance?.enabled) return { allow: true };
  const url = String(path);
  if (
    url.startsWith('/api/auth')
    || url.startsWith('/api/admin')
    || url.startsWith('/api/config')
    || url === '/api/payments/webhook'
  ) {
    return { allow: true };
  }
  if (String(user?.role || '').toLowerCase() === 'admin') return { allow: true };
  return {
    allow: false,
    status: 503,
    body: {
      maintenance: true,
      msg: maintenance.message || 'FootballPro is under maintenance',
      estimatedMinutes: maintenance.estimatedMinutes ?? null,
    },
  };
}

function featureDecision({ enabled, user }) {
  if (enabled !== false) return { allow: true };
  if (String(user?.role || '').toLowerCase() === 'admin') return { allow: true };
  return {
    allow: false,
    status: 503,
    body: { code: 'FEATURE_DISABLED', msg: 'This feature is disabled' },
  };
}

function canonicalReportStatus(status) {
  const key = String(status || '').trim().toLowerCase();
  return REPORT_STATUS_ALIAS[key] || null;
}

function reportCategory(report) {
  const type = String(report?.targetType || '').toLowerCase();
  const reason = String(report?.reason || '').toLowerCase();
  if (['harassment', 'hate', 'violence', 'sexual'].includes(reason)) return 'ABUSE';
  if (reason === 'scam') return 'MARKETPLACE';
  if (type === 'post' || type === 'comment') return 'POST';
  if (type === 'live') return 'VIDEO';
  if (type === 'user' || type === 'profile') {
    return String(report?.targetRole || '').toLowerCase() === 'athlete' ? 'PLAYER' : 'USER';
  }
  return 'OTHER';
}

function stripSecrets(value) {
  if (Array.isArray(value)) return value.map(stripSecrets);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_FIELD.test(key)) continue;
    out[key] = item && typeof item === 'object' ? stripSecrets(item) : item;
  }
  return out;
}

function csvCell(value) {
  if (value == null) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(columns, rows) {
  const header = columns.join(',');
  const lines = rows.map((row) => columns.map((column) => csvCell(row[column])).join(','));
  return [header, ...lines].join('\n');
}

module.exports = {
  DIRECT_BALANCE_KEYS,
  FEATURE_FLAGS,
  OPEN_REPORT_STATUSES,
  EXPORTS,
  SECRET_FIELD,
  requireReason,
  rejectDirectBalanceEdit,
  pageParams,
  maintenanceDecision,
  featureDecision,
  canonicalReportStatus,
  reportCategory,
  stripSecrets,
  csvCell,
  toCsv,
};
