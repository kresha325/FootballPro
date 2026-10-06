'use strict';

const ops = require('../services/admin/ops');
const { can } = require('../services/admin/rbac');
const { requireReason } = require('../services/admin/policy');
const { writeAudit } = require('../services/admin/audit');

function send(res, status, body) {
  return res.status(status).json(body);
}

function guard(req, permission) {
  if (!can(req.user, permission)) {
    const err = new Error('Insufficient admin permission');
    err.status = 403;
    throw err;
  }
}

function wrap(permission, handler) {
  return async (req, res) => {
    try {
      if (permission) guard(req, permission);
      const data = await handler(req);
      if (data && data.csv) {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${data.filename}"`);
        return res.send(data.csv);
      }
      return res.json(data);
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) {
        console.error('admin ops:', err?.message || err);
        return send(res, 500, { msg: 'Server error' });
      }
      return send(res, status, { msg: err.message });
    }
  };
}

exports.session = wrap('dashboard.read', async (req) => ops.sessionFor(req.user));
exports.dashboard = wrap('dashboard.read', async () => ops.dashboard());
exports.search = wrap('search', async (req) => ops.search(req.user, req.query.q));

exports.players = wrap('players.read', async (req) => ops.listPlayers(req.query));
exports.playerAction = wrap('players.manage', async (req) => ops.playerAction(req.user, req.params.id, req.body.action, req.body.reason));
exports.clubs = wrap('clubs.read', async (req) => ops.listClubs(req.query));
exports.clubAction = wrap('clubs.manage', async (req) => ops.clubAction(req.user, req.params.id, req.body.action, req.body.reason));
exports.competitions = wrap('competitions.manage', async (req) => ops.listCompetitions(req.query));
exports.competitionAction = wrap('competitions.manage', async (req) => ops.competitionAction(req.user, req.params.id, req.body.action, req.body.reason));
exports.matches = wrap('matches.manage', async (req) => ops.listMatches(req.query));
exports.matchAction = wrap(null, async (req) => {
  const action = req.body?.action;
  guard(req, action === 'correct' ? 'matches.correct' : 'matches.manage');
  return ops.matchAction(req.user, req.params.id, req.body || {});
});
exports.scouting = wrap('scouting.read', async (req) => ops.listScouting(req.query));
exports.media = wrap('media.manage', async (req) => ops.listMedia(req.query));
exports.mediaAction = wrap('media.manage', async (req) => ops.mediaAction(req.user, req.params.id, req.body.action, req.body.reason));
exports.products = wrap('marketplace.read', async (req) => ops.listProducts(req.query));
exports.productAction = wrap('marketplace.manage', async (req) => ops.productAction(req.user, req.params.id, req.body.action, req.body.reason));
exports.orders = wrap('orders.manage', async (req) => ops.listOrders(req.query));
exports.orderAction = wrap('orders.manage', async (req) => ops.orderAction(req.user, req.params.id, req.body.action, req.body.reason));
exports.sellers = wrap('marketplace.read', async (req) => ops.listSellers(req.query));
exports.finance = wrap('finance.read', async () => ops.financeSummary());
exports.adjust = wrap('finance.adjust', async (req) => ops.createAdjustment(req.user, req.body || {}));
exports.payments = wrap('payments.read', async (req) => ops.listPayments(req.query));
exports.paymentRetry = wrap('payments.read', async () => {
  const err = new Error('Payments cannot be marked successful from the admin panel');
  err.status = 400;
  throw err;
});
exports.notifications = wrap('notifications.read', async (req) => ops.listNotifications(req.query));
exports.invalidTokens = wrap('notifications.read', async (req) => ops.listInvalidTokens(req.query));
exports.notificationAction = wrap('notifications.manage', async (req) => ops.notificationAction(req.user, req.body || {}));
exports.reports = wrap('reports.read', async (req) => ops.listReports(req.query));
exports.reviewReport = wrap('reports.manage', async (req) => {
  if (req.body?.suspend) guard(req, 'users.suspend');
  return ops.reviewReport(req.user, req.params.id, req.body || {});
});
exports.audit = wrap('audit.read', async (req) => ops.listAudit(req.query));
exports.activity = wrap('users.read', async (req) => ops.userActivity(req.params.id));
exports.revoke = wrap('users.sessions', async (req) => ops.trackedRevoke(req.user, req.params.id, req.body?.reason));
exports.system = wrap('system.read', async () => ops.systemHealth());
exports.errors = wrap('errors.read', async (req) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const data = await ops.listErrors({ page, limit: 20 });
  if (req.user && require('../services/admin/rbac').resolveAdminRole(req.user) !== 'super_admin') {
    data.rows = data.rows.map((row) => ({
      id: row.id,
      method: row.method,
      path: row.path,
      count: row.count,
      severity: row.severity,
      statusCode: row.statusCode,
      firstSeenAt: row.firstSeenAt,
      lastSeenAt: row.lastSeenAt,
    }));
  }
  return data;
});
exports.jobs = wrap('jobs.read', async () => ops.listJobs());
exports.retryJob = wrap('jobs.retry', async (req) => {
  const reason = requireReason(req.body?.reason);
  const record = await ops.retryJob(req.params.name);
  await writeAudit({
    adminId: req.user.id,
    action: 'JOB_RETRIED',
    entity: 'job',
    entityId: req.params.name,
    result: record.status === 'failed' ? 'failed' : 'success',
    reason,
  });
  return { ok: record.status !== 'failed', job: record };
});
exports.deployment = wrap('system.read', async () => ops.deploymentInfo());
exports.flags = wrap('system.read', async () => ({ flags: await ops.listFlags() }));
exports.updateFlag = wrap('flags.manage', async (req) => ops.updateFlag(req.user, req.params.flag, req.body?.enabled, req.body?.reason));
exports.maintenance = wrap('system.read', async () => {
  const { getMaintenance } = require('../services/admin/settings');
  return getMaintenance();
});
exports.updateMaintenance = wrap('maintenance.manage', async (req) => ops.updateMaintenance(req.user, req.body || {}));
exports.bulk = wrap(null, async (req) => {
  const action = String(req.body?.action || '');
  if (action === 'verify_users') guard(req, 'users.verify');
  else if (action === 'suspend_users') guard(req, 'users.suspend');
  else if (action === 'archive_products' || action === 'publish_media') guard(req, 'bulk.ops');
  else guard(req, 'bulk.ops');
  return ops.bulk(req.user, req.body || {});
});
exports.exportCsv = wrap(null, async (req) => {
  const kind = req.params.kind;
  const finance = kind === 'transactions' || kind === 'orders';
  guard(req, finance ? 'export.finance' : 'export.ops');
  if (kind === 'users' || kind === 'players' || kind === 'reports') guard(req, 'export.ops');
  return ops.exportRows(kind, req.query);
});
exports.adminRole = wrap('users.role', async (req) => ops.changeAdminRole(req.user, req.params.id, req.body?.adminRole, req.body?.reason));
exports.analytics = wrap('analytics.read', async () => {
  const data = await ops.dashboard();
  return { today: data.today, metrics: data.metrics, api: data.api };
});
