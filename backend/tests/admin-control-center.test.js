/**
 * Admin control center checks.
 * Run: node --test tests/admin-control-center.test.js
 */
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { can, resolveAdminRole, permissionList } = require('../services/admin/rbac');
const { buildAlerts, groupAlerts } = require('../services/admin/alerts');
const { recordRequest, summarize, resetMetrics, normalizePath } = require('../services/admin/metrics');
const {
  requireReason,
  rejectDirectBalanceEdit,
  maintenanceDecision,
  featureDecision,
  canonicalReportStatus,
  reportCategory,
  EXPORTS,
  toCsv,
  stripSecrets,
  SECRET_FIELD,
} = require('../services/admin/policy');
const { sanitizeMessage } = require('../services/admin/errors');
const { deriveServiceStatus } = require('../services/admin/health');
const { canTransition } = require('../utils/competitionLifecycle');

function user(role, adminRole) {
  return { id: 1, role, adminRole };
}

describe('admin roles', () => {
  it('keeps an existing admin with no tier as super admin', () => {
    assert.equal(resolveAdminRole(user('admin', null)), 'super_admin');
    assert.equal(can(user('admin', null), 'finance.adjust'), true);
    assert.equal(can(user('admin', null), 'users.delete'), true);
  });

  it('lets a platform admin manage the product but not edit balances', () => {
    const admin = user('admin', 'admin');
    assert.equal(can(admin, 'users.suspend'), true);
    assert.equal(can(admin, 'matches.correct'), true);
    assert.equal(can(admin, 'finance.read'), true);
    assert.equal(can(admin, 'finance.adjust'), false);
    assert.equal(can(admin, 'users.role'), false);
    assert.equal(can(admin, 'users.delete'), false);
  });

  it('limits moderators to content, users and reports', () => {
    const moderator = user('admin', 'moderator');
    assert.equal(can(moderator, 'reports.manage'), true);
    assert.equal(can(moderator, 'reports.read'), true);
    assert.equal(can(moderator, 'users.suspend'), true);
    assert.equal(can(moderator, 'media.manage'), true);
    assert.equal(can(moderator, 'finance.read'), false);
    assert.equal(can(moderator, 'orders.manage'), false);
    assert.equal(can(moderator, 'maintenance.manage'), false);
  });

  it('limits support to users, orders and payments', () => {
    const support = user('admin', 'support');
    assert.equal(can(support, 'users.read'), true);
    assert.equal(can(support, 'orders.manage'), true);
    assert.equal(can(support, 'payments.read'), true);
    assert.equal(can(support, 'users.suspend'), false);
    assert.equal(can(support, 'finance.adjust'), false);
    assert.deepEqual(permissionList(user('athlete', null)), []);
    assert.equal(can(user('athlete', 'super_admin'), 'dashboard.read'), false);
  });
});

describe('alerts', () => {
  it('groups repeated alert codes and ranks severity', () => {
    const alerts = buildAlerts({
      databaseStatus: 'ERROR',
      failedPayments24h: 6,
      successfulPayments24h: 1,
      apiRequests1h: 40,
      apiErrorRate1h: 0.2,
      pendingVerifications: 20,
      openReports: 4,
      storagePercent: 70,
      streamFailures24h: 0,
      failedJobs: 1,
    });
    assert.equal(alerts[0].severity, 'CRITICAL');
    assert.equal(alerts.some((item) => item.code === 'PAYMENT_FAILURE_SPIKE'), true);
    assert.equal(alerts.some((item) => item.code === 'STORAGE_PRESSURE' && item.severity === 'LOW'), true);
    const grouped = groupAlerts([
      { code: 'OPEN_REPORTS', description: 'Open reports', count: 2, severity: 'LOW' },
      { code: 'OPEN_REPORTS', description: 'Open reports', count: 2, severity: 'LOW' },
    ]);
    assert.equal(grouped.length, 1);
    assert.equal(grouped[0].count, 4);
  });

  it('does not invent a storage alert when the percentage is unavailable', () => {
    const alerts = buildAlerts({ storagePercent: null, databaseStatus: 'ONLINE', backendStatus: 'ONLINE' });
    assert.equal(alerts.some((item) => item.code === 'STORAGE_PRESSURE'), false);
  });
});

describe('api metrics', () => {
  beforeEach(() => resetMetrics());

  it('normalizes ids and summarizes a real window', () => {
    assert.equal(normalizePath('/api/matches/237/events'), '/api/matches/:id/events');
    const now = Date.now();
    recordRequest({ method: 'POST', path: '/api/matches/12', status: 500, durationMs: 40, now });
    recordRequest({ method: 'POST', path: '/api/matches/13', status: 200, durationMs: 10, now });
    const window = summarize('5m', now);
    assert.equal(window.requests, 2);
    assert.equal(window.errors, 1);
    assert.equal(window.errorRate, 0.5);
    assert.equal(window.problematicEndpoints[0].endpoint, 'POST /api/matches/:id');
    assert.equal(window.problematicEndpoints[0].errors, 1);
    assert.equal(window.scope, 'process');
  });
});

describe('dangerous operations and exports', () => {
  it('requires a reason and rejects direct balance edits', () => {
    assert.throws(() => requireReason('no'), /reason/i);
    assert.equal(requireReason('Correct a duplicate reward'), 'Correct a duplicate reward');
    assert.match(rejectDirectBalanceEdit({ joncoinBalance: 50 }), /Direct balance edits/);
    assert.equal(rejectDirectBalanceEdit({ amount: 10, direction: 'credit' }), null);
  });

  it('exports only authorized columns', () => {
    const forbidden = ['password', 'token', 'secret', 'streamKey', 'stripeClientSecret'];
    for (const columns of Object.values(EXPORTS)) {
      for (const column of columns) {
        assert.equal(SECRET_FIELD.test(column), false, column);
        assert.equal(forbidden.includes(column), false);
      }
    }
    const csv = toCsv(EXPORTS.users, [{ id: 1, email: 'a@example.com', firstName: '=cmd' }]);
    assert.match(csv, /id,email/);
    assert.match(csv, /'=cmd/);
    assert.equal(stripSecrets({ id: 1, streamKey: 'secret', title: 'Final' }).streamKey, undefined);
    assert.equal(stripSecrets({ id: 1, streamKey: 'secret', title: 'Final' }).title, 'Final');
  });

  it('sanitizes error text before it is stored', () => {
    const message = sanitizeMessage('password=hunter2 postgres://user:pass@db/app failed for a@b.com');
    assert.equal(message.includes('hunter2'), false);
    assert.equal(message.includes('postgres://'), false);
    assert.equal(message.includes('a@b.com'), false);
  });
});

describe('maintenance, flags, reports and competitions', () => {
  it('lets admins through maintenance and blocks everyone else', () => {
    const maintenance = { enabled: true, message: 'Back soon', estimatedMinutes: 30 };
    assert.equal(maintenanceDecision({ maintenance, user: { role: 'athlete' }, path: '/api/posts' }).allow, false);
    assert.equal(maintenanceDecision({ maintenance, user: { role: 'admin' }, path: '/api/posts' }).allow, true);
    assert.equal(maintenanceDecision({ maintenance, user: null, path: '/api/auth/login' }).allow, true);
    assert.equal(maintenanceDecision({ maintenance, user: null, path: '/api/payments/webhook' }).allow, true);
    assert.equal(maintenanceDecision({ maintenance: { enabled: false }, user: null, path: '/api/posts' }).allow, true);
  });

  it('enforces a disabled feature without replacing authorization', () => {
    assert.equal(featureDecision({ enabled: true, user: null }).allow, true);
    assert.equal(featureDecision({ enabled: false, user: { role: 'athlete' } }).status, 503);
    assert.equal(featureDecision({ enabled: false, user: { role: 'admin' } }).allow, true);
  });

  it('maps report statuses and categories onto the existing report model', () => {
    assert.equal(canonicalReportStatus('OPEN'), 'pending');
    assert.equal(canonicalReportStatus('resolved'), 'resolved');
    assert.equal(reportCategory({ targetType: 'post', reason: 'spam' }), 'POST');
    assert.equal(reportCategory({ targetType: 'user', reason: 'other', targetRole: 'athlete' }), 'PLAYER');
    assert.equal(reportCategory({ targetType: 'message', reason: 'harassment' }), 'ABUSE');
  });

  it('pauses a competition through the existing lifecycle', () => {
    assert.equal(canTransition('in_progress', 'paused').ok, true);
    assert.equal(canTransition('paused', 'in_progress').ok, true);
    assert.equal(canTransition('completed', 'paused').ok, false);
  });

  it('derives service status from measured counts', () => {
    assert.equal(deriveServiceStatus('payments', { paymentsKnown: false }), 'UNKNOWN');
    assert.equal(deriveServiceStatus('payments', { paymentsKnown: true, failedPayments24h: 0 }), 'ONLINE');
    assert.equal(deriveServiceStatus('payments', { paymentsKnown: true, failedPayments24h: 2, successfulPayments24h: 10 }), 'DEGRADED');
    assert.equal(deriveServiceStatus('jobs', { jobsKnown: true, jobsHaveRun: false, failedJobs: 0 }), 'UNKNOWN');
    assert.equal(deriveServiceStatus('streaming', { streamingKnown: true, streamFailures24h: 4 }), 'ERROR');
  });
});

describe('admin route authorization', () => {
  it('rejects an unauthenticated ops request', async () => {
    const admin = require('../middleware/admin');
    const res = mockRes();
    await admin({ header: () => undefined }, res, () => {
      throw new Error('next should not run');
    });
    assert.equal(res.code, 401);
  });

  it('rejects a normal user and allows permission checks for moderator and super admin', async () => {
    process.env.JWT_SECRET = 'admin-control-center-secret';
    process.env.NODE_ENV = 'test';
    const { requirePermission } = require('../middleware/admin');
    const denied = mockRes();
    const next = { called: false };
    const moderator = { id: 4, role: 'admin', adminRole: 'moderator' };
    await requirePermission('finance.adjust')({ user: moderator }, denied, () => {
      next.called = true;
    });
    assert.equal(denied.code, 403);
    assert.equal(next.called, false);

    const allowed = mockRes();
    let passed = false;
    await requirePermission('reports.manage')({ user: moderator }, allowed, () => {
      passed = true;
    });
    assert.equal(passed, true);

    const superAdmin = { id: 2, role: 'admin', adminRole: null };
    let finance = false;
    await requirePermission('finance.adjust')({ user: superAdmin }, mockRes(), () => {
      finance = true;
    });
    assert.equal(finance, true);

    const token = jwt.sign({ user: { id: 9, tv: 0 } }, 'admin-control-center-secret', { expiresIn: '5m' });
    assert.equal(typeof token, 'string');
  });
});

function mockRes() {
  return {
    code: null,
    body: null,
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
}
