'use strict';

const fs = require('fs');
const path = require('path');
const { Op, fn, col, QueryTypes } = require('sequelize');
const sequelize = require('../../config/database');
const User = require('../../models/User');
const Profile = require('../../models/Profile');
const Match = require('../../models/Match');
const { Tournament } = require('../../models/Tournament');
const Order = require('../../models/Order');
const Payment = require('../../models/Payment');
const PaymentEvent = require('../../models/PaymentEvent');
const Product = require('../../models/Product');
const Report = require('../../models/Report');
const Stream = require('../../models/Stream');
const Notification = require('../../models/Notification');
const PushDevice = require('../../models/PushDevice');
const MediaItem = require('../../models/MediaItem');
const ScoutingReport = require('../../models/ScoutingReport');
const { JonCoinTransaction, WithdrawalRequest } = require('../../models');
const { CREDIT_TYPES, DEBIT_TYPES } = require('../economy/rules');
const { postLedgerEntry } = require('../economy/ledger');
const { toCents } = require('../../utils/money');
const { profileCompletenessScore } = require('../../utils/profileFields');
const competitionService = require('../competitionService');
const { canManageTournamentMatches } = require('../../utils/matchPermissions');
const { can, resolveAdminRole, permissionList } = require('./rbac');
const { writeAudit } = require('./audit');
const { buildAlerts } = require('./alerts');
const { snapshot: apiSnapshot } = require('./metrics');
const { listErrors } = require('./errors');
const { listJobs, retryJob, failedJobCount } = require('./jobs');
const { checkBackend, checkDatabase, checkStorage, cacheStatus, deriveServiceStatus } = require('./health');
const { listFlags, writeSetting, getMaintenance } = require('./settings');
const { snapshot: deliverySnapshot } = require('./deliverySignals');
const {
  requireReason,
  rejectDirectBalanceEdit,
  pageParams,
  OPEN_REPORT_STATUSES,
  canonicalReportStatus,
  reportCategory,
  stripSecrets,
  EXPORTS,
  toCsv,
  FEATURE_FLAGS,
} = require('./policy');
const {
  httpError,
  suspendUser,
  restoreUser,
  verifyUser,
  unverifyAthlete,
  revokeSessions,
} = require('./accounts');
const FinancialAdjustment = require('../../models/FinancialAdjustment');

const USER_PUBLIC = ['id', 'firstName', 'lastName', 'email', 'role', 'verified', 'adminVerified', 'clubVerified', 'bannedAt', 'createdAt', 'lastSeenAt'];

function sinceHours(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function startOfUtcDay() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function safe(label, fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.warn(`admin.${label}:`, err?.message || err);
    return fallback;
  }
}

function paged(result, page, limit) {
  const total = result.count;
  return {
    rows: result.rows,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit) || 1),
  };
}

function sessionFor(user) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    adminRole: resolveAdminRole(user),
    permissions: permissionList(user),
  };
}

async function countWhere(model, where) {
  return safe(model.name || 'count', () => model.count({ where }), null);
}

async function dashboard() {
  const started = Date.now();
  const day = startOfUtcDay();
  const dayAgo = sinceHours(24);
  const weekAgo = sinceHours(24 * 7);

  const [
    backend,
    database,
    storage,
    totalUsers,
    activeUsers,
    players,
    clubs,
    matches,
    liveStreams,
    orders,
    openReports,
    abuseReports,
    pendingVerifications,
    newUsers,
    newPlayers,
    ordersToday,
    failedPayments,
    successfulPayments,
    pendingPayments,
    streamFailures,
    invalidatedTokens,
    circulation,
    revenue,
  ] = await Promise.all([
    checkBackend(started),
    checkDatabase(),
    checkStorage(),
    countWhere(User, {}),
    countWhere(User, { lastSeenAt: { [Op.gte]: weekAgo } }),
    countWhere(User, { role: 'athlete' }),
    countWhere(User, { role: 'club' }),
    countWhere(Match, {}),
    countWhere(Stream, { [Op.or]: [{ status: 'live' }, { isLive: true }] }),
    countWhere(Order, {}),
    countWhere(Report, { status: { [Op.in]: OPEN_REPORT_STATUSES } }),
    countWhere(Report, {
      status: { [Op.in]: OPEN_REPORT_STATUSES },
      reason: { [Op.in]: ['harassment', 'hate', 'violence', 'sexual', 'scam'] },
    }),
    countWhere(User, { role: 'athlete', clubVerified: false, bannedAt: null }),
    countWhere(User, { createdAt: { [Op.gte]: day } }),
    countWhere(User, { role: 'athlete', createdAt: { [Op.gte]: day } }),
    countWhere(Order, { createdAt: { [Op.gte]: day } }),
    countWhere(Payment, { status: 'failed', createdAt: { [Op.gte]: dayAgo } }),
    countWhere(Payment, { status: 'completed', createdAt: { [Op.gte]: dayAgo } }),
    countWhere(Payment, { status: 'pending' }),
    countWhere(Stream, { status: 'failed', updatedAt: { [Op.gte]: dayAgo } }),
    countWhere(PushDevice, { invalidatedAt: { [Op.gte]: dayAgo } }),
    joncoinCirculation(),
    revenueByCurrency(),
  ]);

  const delivery = deliverySnapshot();
  const notificationFailures = (invalidatedTokens || 0) + delivery.email + delivery.push + delivery.invalidToken;
  const notificationsKnown = invalidatedTokens != null;
  const jobs = await safe('jobs', () => listJobs(), { jobs: [] });
  const failedJobs = (jobs.jobs || []).filter((job) => job.status === 'failed').length || failedJobCount();
  const jobsHaveRun = (jobs.jobs || []).some((job) => job.status === 'success' || job.status === 'failed');
  const api = apiSnapshot();
  const api1h = api.windows['1h'];

  const signals = {
    databaseStatus: database.status,
    backendStatus: backend.status,
    failedPayments24h: failedPayments || 0,
    successfulPayments24h: successfulPayments || 0,
    paymentsKnown: failedPayments != null,
    apiRequests1h: api1h.requests,
    apiErrorRate1h: api1h.errorRate,
    streamFailures24h: streamFailures || 0,
    streamingKnown: streamFailures != null,
    notificationFailures24h: notificationsKnown || delivery.email || delivery.push ? notificationFailures : 0,
    notificationsKnown,
    pendingVerifications: pendingVerifications || 0,
    failedJobs,
    openReports: openReports || 0,
    abuseReports: abuseReports || 0,
    storagePercent: storage.percent,
    jobsKnown: true,
    jobsHaveRun,
  };

  const alerts = buildAlerts(signals);
  const notificationsStatus = deriveServiceStatus('notifications', signals);
  const paymentsStatus = deriveServiceStatus('payments', signals);
  const streamingStatus = deriveServiceStatus('streaming', signals);
  const jobsStatus = deriveServiceStatus('jobs', signals);

  const subsystems = [
    backend,
    database,
    storage,
    cacheStatus(),
    {
      key: 'notifications',
      label: 'NOTIFICATIONS',
      status: notificationsStatus,
      latencyMs: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      detail: notificationsKnown ? null : 'Notification failure history is only partially recorded',
    },
    {
      key: 'payments',
      label: 'PAYMENTS',
      status: paymentsStatus,
      latencyMs: null,
      failed24h: failedPayments,
      successful24h: successfulPayments,
      pending: pendingPayments,
    },
    {
      key: 'streaming',
      label: 'STREAMING',
      status: streamingStatus,
      latencyMs: null,
      failures24h: streamFailures,
    },
    {
      key: 'jobs',
      label: 'BACKGROUND JOBS',
      status: jobsStatus,
      latencyMs: null,
      failed: failedJobs,
    },
  ];

  const known = subsystems.filter((item) => item.status !== 'UNKNOWN');
  const online = known.filter((item) => item.status === 'ONLINE').length;
  const systemHealthPercent = known.length ? Math.round((online / known.length) * 1000) / 10 : null;

  return {
    generatedAt: new Date().toISOString(),
    today: {
      systemHealthPercent,
      apiErrors: api.windows['24h'].errors,
      failedPayments,
      failedJobs,
      openReports,
      newUsers,
      newPlayers,
      orders: ordersToday,
      liveStreams,
      storagePercent: storage.percent,
    },
    status: subsystems,
    alerts,
    actionRequired: alerts,
    metrics: {
      totalUsers,
      activeUsers,
      activeUsersWindow: '7d',
      players,
      clubs,
      matches,
      liveStreams,
      orders,
      revenue,
      joncoinCirculation: circulation,
      openReports,
    },
    api,
    notes: [
      'API counters cover this process and reset on restart.',
      'Storage percentage is the host disk that contains uploads. Provider quota is not connected.',
      'JonCoin circulation is the completed ledger, not a manual balance edit.',
    ],
  };
}

async function joncoinCirculation() {
  return safe('circulation', async () => {
    const credits = [...CREDIT_TYPES];
    const debits = [...DEBIT_TYPES];
    const [row] = await sequelize.query(
      `SELECT COALESCE(SUM(CASE
          WHEN type IN (:credits) AND status = 'completed' THEN amount
          WHEN type IN (:debits) AND status = 'completed' THEN -amount
          ELSE 0 END), 0) AS circulation
       FROM "JonCoinTransactions"`,
      { replacements: { credits, debits }, type: QueryTypes.SELECT }
    );
    return row?.circulation == null ? null : Number(row.circulation);
  }, null);
}

async function revenueByCurrency() {
  return safe('revenue', async () => {
    const rows = await Order.findAll({
      attributes: ['currency', [fn('SUM', col('totalAmount')), 'amount'], [fn('COUNT', col('id')), 'count']],
      where: { status: { [Op.in]: ['paid', 'processing', 'shipped', 'delivered'] } },
      group: ['currency'],
      raw: true,
    });
    return rows.map((row) => ({
      currency: row.currency,
      amount: row.amount == null ? null : Number(row.amount),
      count: Number(row.count || 0),
    }));
  }, null);
}

function like(value) {
  return { [Op.iLike]: `%${String(value).slice(0, 80)}%` };
}

async function search(user, rawQuery) {
  const q = String(rawQuery || '').trim();
  if (q.length < 2) return { query: q, groups: [] };
  const id = /^\d+$/.test(q) ? Number(q) : null;
  const groups = [];

  async function add(permission, type, loader) {
    if (!can(user, permission)) return;
    const rows = await safe(`search.${type}`, loader, []);
    if (rows && rows.length) groups.push({ type, rows });
  }

  await add('users.read', 'users', async () => {
    const where = {
      [Op.or]: [
        { email: like(q) },
        { firstName: like(q) },
        { lastName: like(q) },
        ...(id ? [{ id }] : []),
      ],
    };
    const rows = await User.findAll({ where, attributes: USER_PUBLIC, limit: 5, order: [['id', 'DESC']] });
    return rows.map((row) => ({
      id: row.id,
      label: `${row.firstName || ''} ${row.lastName || ''}`.trim() || row.email,
      detail: row.email,
      href: '/admin/users',
    }));
  });

  await add('players.read', 'players', async () => {
    const rows = await User.findAll({
      where: {
        role: 'athlete',
        [Op.or]: [{ email: like(q) }, { firstName: like(q) }, { lastName: like(q) }, ...(id ? [{ id }] : [])],
      },
      attributes: ['id', 'firstName', 'lastName', 'email'],
      limit: 5,
    });
    return rows.map((row) => ({
      id: row.id,
      label: `${row.firstName || ''} ${row.lastName || ''}`.trim() || row.email,
      detail: row.email,
      href: '/admin/players',
    }));
  });

  await add('clubs.read', 'clubs', async () => {
    const rows = await User.findAll({
      where: {
        role: 'club',
        [Op.or]: [{ email: like(q) }, { firstName: like(q) }, { lastName: like(q) }, ...(id ? [{ id }] : [])],
      },
      attributes: ['id', 'firstName', 'lastName', 'email'],
      limit: 5,
    });
    return rows.map((row) => ({
      id: row.id,
      label: `${row.firstName || ''} ${row.lastName || ''}`.trim() || row.email,
      href: '/admin/clubs',
    }));
  });

  await add('matches.manage', 'matches', async () => {
    const where = id ? { id } : { [Op.or]: [{ publicSlug: like(q) }, { venue: like(q) }] };
    const rows = await Match.findAll({ where, attributes: ['id', 'publicSlug', 'status', 'matchDate'], limit: 5 });
    return rows.map((row) => ({
      id: row.id,
      label: row.publicSlug || `Match ${row.id}`,
      detail: row.status,
      href: '/admin/matches',
    }));
  });

  await add('competitions.manage', 'competitions', async () => {
    const rows = await Tournament.findAll({
      where: { [Op.or]: [{ name: like(q) }, { slug: like(q) }, ...(id ? [{ id }] : [])] },
      attributes: ['id', 'name', 'slug', 'status'],
      limit: 5,
    });
    return rows.map((row) => ({ id: row.id, label: row.name, detail: row.status, href: '/admin/competitions' }));
  });

  await add('competitions.manage', 'tournaments', async () => {
    const rows = await Tournament.findAll({
      where: { [Op.or]: [{ name: like(q) }, { slug: like(q) }, ...(id ? [{ id }] : [])] },
      attributes: ['id', 'name', 'status'],
      limit: 5,
    });
    return rows.map((row) => ({ id: row.id, label: row.name, detail: row.status, href: '/admin/competitions' }));
  });

  await add('orders.manage', 'orders', async () => {
    if (!id) return [];
    const rows = await Order.findAll({ where: { id }, attributes: ['id', 'status', 'totalAmount', 'currency'], limit: 5 });
    return rows.map((row) => ({
      id: row.id,
      label: `Order ${row.id}`,
      detail: `${row.status} ${row.totalAmount} ${row.currency}`,
      href: '/admin/marketplace',
    }));
  });

  if (can(user, 'finance.read') || can(user, 'payments.read')) await add('dashboard.read', 'transactions', async () => {
    const where = id
      ? { id }
      : { description: like(q) };
    const rows = await JonCoinTransaction.findAll({
      where,
      attributes: ['id', 'userId', 'type', 'amount', 'status', 'currency'],
      limit: 5,
    });
    return rows.map((row) => ({
      id: row.id,
      label: `Transaction ${row.id}`,
      detail: `${row.type} ${row.amount} ${row.currency} ${row.status}`,
      href: '/admin/finance',
    }));
  });

  await add('marketplace.read', 'products', async () => {
    const rows = await Product.findAll({
      where: { [Op.or]: [{ name: like(q) }, { slug: like(q) }, ...(id ? [{ id }] : [])] },
      attributes: ['id', 'name', 'status', 'price', 'currency'],
      limit: 5,
    });
    return rows.map((row) => ({ id: row.id, label: row.name, detail: row.status, href: '/admin/marketplace' }));
  });

  await add('media.manage', 'videos', async () => {
    const rows = await MediaItem.findAll({
      where: id ? { id } : { title: like(q) },
      attributes: ['id', 'title', 'visibility'],
      limit: 5,
    });
    return rows.map((row) => ({ id: row.id, label: row.title || `Media ${row.id}`, detail: row.visibility, href: '/admin/media' }));
  });

  await add('reports.read', 'reports', async () => {
    if (!id) return [];
    const rows = await Report.findAll({ where: { id }, attributes: ['id', 'targetType', 'status', 'reason'], limit: 5 });
    return rows.map((row) => ({ id: row.id, label: `Report ${row.id}`, detail: `${row.targetType} ${row.status}`, href: '/admin/reports' }));
  });

  return { query: q, groups };
}

async function listPlayers(query) {
  const { limit, page, offset } = pageParams(query);
  const where = { role: 'athlete' };
  if (query.q) {
    where[Op.or] = [{ firstName: like(query.q) }, { lastName: like(query.q) }, { email: like(query.q) }];
  }
  if (query.verified === 'true') where.clubVerified = true;
  if (query.verified === 'false') where.clubVerified = false;
  if (query.status === 'suspended') where.bannedAt = { [Op.ne]: null };
  if (query.status === 'active') where.bannedAt = null;
  const result = await User.findAndCountAll({
    where,
    attributes: USER_PUBLIC,
    include: [{ model: Profile, attributes: ['position', 'club', 'profilePhoto', 'stats', 'featured', 'country', 'city'], required: false }],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    distinct: true,
  });
  const rows = result.rows.map((user) => {
    const json = user.toJSON();
    const profile = json.Profile || null;
    const completeness = profile ? profileCompletenessScore(profile, { user: json }) : null;
    return {
      id: json.id,
      name: `${json.firstName || ''} ${json.lastName || ''}`.trim(),
      email: json.email,
      verified: json.verified,
      clubVerified: json.clubVerified,
      suspended: Boolean(json.bannedAt),
      position: profile?.position || null,
      club: profile?.club || null,
      featured: Boolean(profile?.featured),
      completeness: completeness?.percent ?? null,
      stats: profile?.stats && typeof profile.stats === 'object'
        ? {
          appearances: profile.stats.appearances ?? null,
          goals: profile.stats.goals ?? null,
          assists: profile.stats.assists ?? null,
        }
        : null,
      createdAt: json.createdAt,
      lastSeenAt: json.lastSeenAt,
    };
  });
  return { ...paged({ count: result.count, rows }, page, limit) };
}

async function playerAction(admin, userId, action, reason) {
  const text = requireReason(reason);
  let result = 'success';
  if (action === 'verify') await verifyUser(userId);
  else if (action === 'unverify') await unverifyAthlete(userId);
  else if (action === 'suspend') await suspendUser(userId, text, admin.id);
  else if (action === 'restore') await restoreUser(userId);
  else if (action === 'feature' || action === 'unfeature') {
    const profile = await Profile.findOne({ where: { userId } });
    if (!profile) throw httpError(404, 'Profile not found');
    profile.featured = action === 'feature';
    await profile.save();
  } else throw httpError(400, 'Unknown player action');
  await writeAudit({
    adminId: admin.id,
    action: action === 'verify' ? 'PLAYER_VERIFIED' : `PLAYER_${action.toUpperCase()}`,
    entity: 'user',
    entityId: userId,
    result,
    reason: text,
  });
  return { ok: true };
}

async function listClubs(query) {
  const { limit, page, offset } = pageParams(query);
  const where = { role: 'club' };
  if (query.q) where[Op.or] = [{ firstName: like(query.q) }, { lastName: like(query.q) }, { email: like(query.q) }];
  if (query.status === 'suspended') where.bannedAt = { [Op.ne]: null };
  const result = await User.findAndCountAll({
    where,
    attributes: USER_PUBLIC,
    include: [{ model: Profile, attributes: ['club', 'league', 'city', 'country'], required: false }],
    limit,
    offset,
    order: [['createdAt', 'DESC']],
    distinct: true,
  });
  const rows = result.rows.map((row) => {
    const json = row.toJSON();
    return {
      id: json.id,
      name: json.Profile?.club || `${json.firstName || ''} ${json.lastName || ''}`.trim() || json.email,
      email: json.email,
      verified: json.verified,
      adminVerified: json.adminVerified,
      suspended: Boolean(json.bannedAt),
      league: json.Profile?.league || null,
      city: json.Profile?.city || null,
      createdAt: json.createdAt,
    };
  });
  return paged({ count: result.count, rows }, page, limit);
}

async function clubAction(admin, userId, action, reason) {
  const text = requireReason(reason);
  const user = await User.findByPk(userId);
  if (!user || user.role !== 'club') throw httpError(404, 'Club not found');
  if (action === 'verify') await verifyUser(userId);
  else if (action === 'suspend') await suspendUser(userId, text, admin.id);
  else if (action === 'restore') await restoreUser(userId);
  else throw httpError(400, 'Unknown club action');
  await writeAudit({
    adminId: admin.id,
    action: `CLUB_${action.toUpperCase()}`,
    entity: 'club',
    entityId: userId,
    result: 'success',
    reason: text,
  });
  return { ok: true };
}

async function listCompetitions(query) {
  const { limit, page, offset } = pageParams(query);
  const where = {};
  if (query.q) where[Op.or] = [{ name: like(query.q) }, { slug: like(query.q) }, { season: like(query.q) }];
  if (query.status) where.status = query.status;
  const result = await Tournament.findAndCountAll({
    where,
    attributes: ['id', 'name', 'slug', 'type', 'season', 'status', 'lifecycle', 'startDate', 'endDate', 'creatorId'],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });
  const rows = await Promise.all(result.rows.map(async (row) => {
    const json = row.toJSON();
    json.matches = await safe('comp.matches', () => Match.count({ where: { tournamentId: json.id } }), null);
    return json;
  }));
  return paged({ count: result.count, rows }, page, limit);
}

async function competitionAction(admin, id, action, reason) {
  const text = requireReason(reason);
  const tournament = await Tournament.findByPk(id);
  if (!tournament) throw httpError(404, 'Competition not found');
  const lifecycle = tournament.lifecycle || tournament.status;
  let next = null;
  if (action === 'publish') next = lifecycle === 'draft' ? 'registration' : 'active';
  else if (action === 'pause') next = 'paused';
  else if (action === 'archive') next = 'cancelled';
  else throw httpError(400, 'Unknown competition action');
  try {
    await competitionService.applyLifecycle({ tournamentId: id, user: admin, lifecycle: next });
  } catch (err) {
    throw httpError(err.status || 400, err.message || 'Competition update failed');
  }
  await writeAudit({
    adminId: admin.id,
    action: `COMPETITION_${action.toUpperCase()}`,
    entity: 'tournament',
    entityId: id,
    result: 'success',
    reason: text,
    metadata: { lifecycle: next },
  });
  return { ok: true, lifecycle: next };
}

async function listMatches(query) {
  const { limit, page, offset } = pageParams(query);
  const where = {};
  if (query.status) where.status = query.status;
  if (query.q && /^\d+$/.test(query.q)) where.id = Number(query.q);
  else if (query.q) where[Op.or] = [{ venue: like(query.q) }, { publicSlug: like(query.q) }];
  const result = await Match.findAndCountAll({
    where,
    attributes: ['id', 'tournamentId', 'homeUserId', 'awayUserId', 'scoreHome', 'scoreAway', 'matchDate', 'status', 'venue', 'publicSlug', 'highlightsUrl'],
    include: [
      { model: Tournament, attributes: ['id', 'name'], required: false },
      { model: User, as: 'homeUser', attributes: ['id', 'firstName', 'lastName'], required: false },
      { model: User, as: 'awayUser', attributes: ['id', 'firstName', 'lastName'], required: false },
    ],
    order: [['matchDate', 'DESC']],
    limit,
    offset,
    distinct: true,
  });
  const rows = result.rows.map((row) => {
    const json = row.toJSON();
    const name = (user) => (user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : null);
    return {
      id: json.id,
      competition: json.Tournament?.name || null,
      tournamentId: json.tournamentId,
      home: name(json.homeUser),
      away: name(json.awayUser),
      date: json.matchDate,
      venue: json.venue,
      status: json.status,
      scoreHome: json.scoreHome,
      scoreAway: json.scoreAway,
      highlightsUrl: json.highlightsUrl,
    };
  });
  return paged({ count: result.count, rows }, page, limit);
}

async function matchAction(admin, id, body) {
  const text = requireReason(body.reason);
  const match = await Match.findByPk(id, { include: [{ model: Tournament }] });
  if (!match) throw httpError(404, 'Match not found');
  const action = String(body.action || '');
  if (action === 'correct') {
    try {
      await competitionService.recordOfficialResult({
        matchId: id,
        user: admin,
        payload: {
          scoreHome: body.scoreHome,
          scoreAway: body.scoreAway,
          halfTimeHome: body.halfTimeHome,
          halfTimeAway: body.halfTimeAway,
        },
      });
    } catch (err) {
      throw httpError(err.status || 400, err.message || 'Score update failed');
    }
  } else {
    const authz = canManageTournamentMatches(match.Tournament, admin);
    if (!authz.ok) throw httpError(authz.status || 403, authz.msg);
    if (action === 'reschedule') {
      if (!body.matchDate) throw httpError(400, 'A new date is required');
      competitionService.assertScheduledDate(match.Tournament, body.matchDate);
      match.matchDate = new Date(body.matchDate);
      await match.save();
    } else if (action === 'postpone') {
      match.status = 'postponed';
      await match.save();
    } else if (action === 'cancel') {
      const wasFinished = match.status === 'finished';
      match.status = 'cancelled';
      await match.save();
      if (wasFinished) {
        await competitionService.recomputeTournamentStandings(match.tournamentId);
      }
    } else if (action === 'edit') {
      if (body.venue != null) match.venue = String(body.venue).slice(0, 160);
      if (body.highlightsUrl != null) match.highlightsUrl = String(body.highlightsUrl).slice(0, 500);
      await match.save();
    } else throw httpError(400, 'Unknown match action');
  }
  await writeAudit({
    adminId: admin.id,
    action: action === 'correct' ? 'MATCH_UPDATED' : `MATCH_${action.toUpperCase()}`,
    entity: 'match',
    entityId: id,
    result: 'success',
    reason: text,
  });
  return { ok: true };
}

async function listScouting(query) {
  const { limit, page, offset } = pageParams(query);
  const where = {};
  if (query.status) where.status = query.status;
  const result = await ScoutingReport.findAndCountAll({
    where,
    attributes: ['id', 'scoutId', 'playerId', 'reportDate', 'status', 'overallRating', 'recommendation', 'createdAt'],
    include: [
      { model: User, as: 'scout', attributes: ['id', 'firstName', 'lastName'], required: false },
      { model: User, as: 'player', attributes: ['id', 'firstName', 'lastName'], required: false },
    ],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    distinct: true,
  });
  const playerIds = result.rows.map((row) => row.playerId);
  const flags = playerIds.length
    ? await safe('scout.flags', () => Report.findAll({
      where: {
        targetId: { [Op.in]: playerIds },
        targetType: { [Op.in]: ['user', 'profile'] },
        status: { [Op.in]: OPEN_REPORT_STATUSES },
      },
      attributes: ['targetId'],
    }), [])
    : [];
  const flagged = new Set(flags.map((row) => Number(row.targetId)));
  const rows = result.rows.map((row) => {
    const json = row.toJSON();
    return {
      id: json.id,
      scout: json.scout ? `${json.scout.firstName || ''} ${json.scout.lastName || ''}`.trim() : json.scoutId,
      player: json.player ? `${json.player.firstName || ''} ${json.player.lastName || ''}`.trim() : json.playerId,
      playerId: json.playerId,
      reportDate: json.reportDate,
      status: json.status,
      overallRating: json.overallRating,
      recommendation: json.recommendation,
      flagged: flagged.has(Number(json.playerId)),
      createdAt: json.createdAt,
    };
  });
  return paged({ count: result.count, rows }, page, limit);
}

const MEDIA_ATTRS = ['id', 'title', 'category', 'visibility', 'featured', 'uploadedBy', 'matchId', 'createdAt', 'publishedAt'];

async function listMedia(query) {
  const { limit, page, offset } = pageParams(query);
  const section = String(query.section || 'videos');
  if (section === 'live') {
    const result = await Stream.findAndCountAll({
      attributes: ['id', 'title', 'status', 'visibility', 'provider', 'viewers', 'streamerId', 'matchId', 'createdAt', 'isLive'],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
    const rows = result.rows.map((row) => stripSecrets({
      ...row.toJSON(),
      ownerId: row.streamerId,
      views: row.viewers,
      kind: 'live',
    }));
    return paged({ count: result.count, rows }, page, limit);
  }
  if (section === 'replays') {
    const LiveStreamReplay = require('../../models/LiveStreamReplay');
    const result = await LiveStreamReplay.findAndCountAll({
      attributes: ['id', 'streamId', 'userId', 'highlight', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
    const rows = result.rows.map((row) => ({
      id: row.id,
      ownerId: row.userId,
      matchId: null,
      status: row.highlight ? 'highlight' : 'replay',
      provider: null,
      views: null,
      createdAt: row.createdAt,
      kind: 'replay',
    }));
    return paged({ count: result.count, rows }, page, limit);
  }
  const where = {};
  if (section === 'highlights') where.category = { [Op.in]: ['match_highlight', 'goal', 'assist', 'save'] };
  if (query.q) where.title = like(query.q);
  const result = await MediaItem.findAndCountAll({
    where,
    attributes: MEDIA_ATTRS,
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });
  const rows = result.rows.map((row) => ({
    ...row.toJSON(),
    ownerId: row.uploadedBy,
    status: row.visibility,
    provider: 'media',
    views: null,
    kind: section,
  }));
  return paged({ count: result.count, rows }, page, limit);
}

async function mediaAction(admin, id, action, reason) {
  const text = requireReason(reason);
  const item = await MediaItem.findByPk(id);
  if (!item) throw httpError(404, 'Media not found');
  if (action === 'publish') {
    item.visibility = 'public';
    item.publishedAt = item.publishedAt || new Date();
  } else if (action === 'unpublish' || action === 'remove') {
    item.visibility = 'private';
    item.featured = false;
  } else if (action === 'feature') {
    item.featured = true;
    item.visibility = 'public';
  } else throw httpError(400, 'Unknown media action');
  await item.save();
  await writeAudit({
    adminId: admin.id,
    action: `MEDIA_${action.toUpperCase()}`,
    entity: 'media',
    entityId: id,
    result: 'success',
    reason: text,
  });
  return { ok: true };
}

async function listProducts(query) {
  const { limit, page, offset } = pageParams(query);
  const where = {};
  if (query.q) where[Op.or] = [{ name: like(query.q) }, { slug: like(query.q) }];
  if (query.status) where.status = query.status;
  const result = await Product.findAndCountAll({
    where,
    attributes: ['id', 'name', 'slug', 'sellerId', 'status', 'stock', 'price', 'currency', 'createdAt'],
    include: [{ model: User, as: 'Seller', attributes: ['id', 'firstName', 'lastName', 'email'], required: false }],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    distinct: true,
  });
  return paged({ count: result.count, rows: result.rows.map((row) => row.toJSON()) }, page, limit);
}

async function listOrders(query) {
  const { limit, page, offset } = pageParams(query);
  const where = {};
  if (query.status) where.status = query.status;
  if (query.q && /^\d+$/.test(query.q)) where.id = Number(query.q);
  const result = await Order.findAndCountAll({
    where,
    attributes: ['id', 'userId', 'sellerId', 'status', 'currency', 'totalAmount', 'paymentMethod', 'createdAt', 'updatedAt'],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });
  return paged({ count: result.count, rows: result.rows.map((row) => row.toJSON()) }, page, limit);
}

async function listSellers(query) {
  const { limit, page, offset } = pageParams(query);
  return safe('sellers', async () => {
    const rows = await sequelize.query(
      `SELECT p."sellerId" AS id, COUNT(*)::int AS products,
              u."firstName", u."lastName", u.email
       FROM "Products" p
       JOIN "Users" u ON u.id = p."sellerId"
       GROUP BY p."sellerId", u."firstName", u."lastName", u.email
       ORDER BY products DESC
       LIMIT :limit OFFSET :offset`,
      { replacements: { limit, offset }, type: QueryTypes.SELECT }
    );
    const [countRow] = await sequelize.query(
      'SELECT COUNT(DISTINCT "sellerId")::int AS total FROM "Products"',
      { type: QueryTypes.SELECT }
    );
    return {
      rows,
      total: Number(countRow?.total || 0),
      page,
      pages: Math.max(1, Math.ceil(Number(countRow?.total || 0) / limit) || 1),
    };
  }, { rows: [], total: null, page, pages: 1 });
}

async function productAction(admin, id, action, reason) {
  const text = requireReason(reason);
  const product = await Product.findByPk(id);
  if (!product) throw httpError(404, 'Product not found');
  if (action === 'archive' || action === 'remove') product.status = 'archived';
  else if (action === 'publish') product.status = 'active';
  else throw httpError(400, 'Unknown product action');
  await product.save();
  await writeAudit({
    adminId: admin.id,
    action: action === 'remove' ? 'PRODUCT_REMOVED' : `PRODUCT_${action.toUpperCase()}`,
    entity: 'product',
    entityId: id,
    result: 'success',
    reason: text,
  });
  return { ok: true };
}

async function orderAction(admin, id, action, reason) {
  const text = requireReason(reason);
  const { refundOrder, transitionOrder } = require('../economy/checkout');
  if (action === 'refund') {
    await refundOrder(id, admin);
  } else if (['processing', 'shipped', 'delivered', 'cancelled'].includes(action)) {
    await transitionOrder(id, action, admin);
  } else if (action === 'paid' || action === 'mark_paid') {
    throw httpError(400, 'Payments cannot be marked successful from the admin panel');
  } else throw httpError(400, 'Unknown order action');
  await writeAudit({
    adminId: admin.id,
    action: action === 'refund' ? 'ORDER_REFUNDED' : `ORDER_${action.toUpperCase()}`,
    entity: 'order',
    entityId: id,
    result: 'success',
    reason: text,
  });
  return { ok: true };
}

async function financeSummary() {
  const dayAgo = sinceHours(24);
  const [circulation, revenue, volume, successful, failed, pending, refunds, adjustments, review] = await Promise.all([
    joncoinCirculation(),
    revenueByCurrency(),
    safe('tx.volume', () => JonCoinTransaction.sum('amount', { where: { status: 'completed', createdAt: { [Op.gte]: dayAgo } } }), null),
    countWhere(Payment, { status: 'completed' }),
    countWhere(Payment, { status: 'failed' }),
    countWhere(Payment, { status: 'pending' }),
    countWhere(Order, { status: 'refunded' }),
    safe('adjustments', () => FinancialAdjustment.findAll({
      attributes: ['id', 'adminId', 'userId', 'direction', 'amount', 'balanceBefore', 'balanceAfter', 'reason', 'ledgerTransactionId', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: 20,
    }), []),
    reviewTransactions(),
  ]);
  return {
    joncoinCirculation: circulation,
    transactionVolume24h: volume == null ? null : Number(volume),
    revenue,
    payments: { successful, failed, pending },
    refunds,
    adjustments,
    review,
  };
}

async function reviewTransactions() {
  const payments = await safe('review.payments', () => Payment.findAll({
    where: { status: 'failed' },
    attributes: ['id', 'userId', 'amount', 'currency', 'status', 'createdAt'],
    order: [['createdAt', 'DESC']],
    limit: 10,
  }), []);
  const withdrawals = WithdrawalRequest
    ? await safe('review.withdrawals', () => WithdrawalRequest.findAll({
      where: { status: 'pending' },
      attributes: ['id', 'userId', 'amount', 'status', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: 10,
    }), [])
    : [];
  return {
    failedPayments: payments.map((row) => row.toJSON()),
    pendingWithdrawals: withdrawals.map((row) => (row.toJSON ? row.toJSON() : row)),
  };
}

async function createAdjustment(admin, body) {
  const blocked = rejectDirectBalanceEdit(body);
  if (blocked) throw httpError(400, blocked);
  const text = requireReason(body.reason);
  const direction = body.direction === 'debit' ? 'debit' : body.direction === 'credit' ? 'credit' : null;
  if (!direction) throw httpError(400, 'Direction must be credit or debit');
  const cents = toCents(body.amount);
  if (cents == null || cents <= 0) throw httpError(400, 'Amount must be a positive value with at most 2 decimals');
  const userId = parseInt(body.userId, 10);
  if (!userId) throw httpError(400, 'User is required');
  const type = direction === 'credit' ? 'reward' : 'reversal';
  const result = await sequelize.transaction(async (transaction) => {
    const posted = await postLedgerEntry({
      userId,
      type,
      amountCents: cents,
      status: 'completed',
      description: `Admin adjustment: ${text}`.slice(0, 255),
      relatedEntityType: 'admin_adjustment',
      relatedEntityId: admin.id,
      idempotencyKey: body.idempotencyKey ? String(body.idempotencyKey).slice(0, 191) : null,
    }, transaction);
    if (posted.duplicate) return { adjustment: null, entry: posted.entry, duplicate: true };
    const entry = posted.entry;
    const adjustment = await FinancialAdjustment.create({
      adminId: admin.id,
      userId,
      direction,
      amount: entry.amount,
      balanceBefore: entry.balanceBefore,
      balanceAfter: entry.balanceAfter,
      reason: text,
      ledgerTransactionId: entry.id,
    }, { transaction });
    return { adjustment, duplicate: false };
  });
  if (result.duplicate) {
    return { duplicate: true, ledgerTransactionId: result.entry?.id || null };
  }
  await writeAudit({
    adminId: admin.id,
    action: 'FINANCIAL_ADJUSTMENT',
    entity: 'user',
    entityId: userId,
    result: result.duplicate ? 'duplicate' : 'success',
    reason: text,
    metadata: {
      direction,
      before: result.adjustment.balanceBefore,
      adjustment: result.adjustment.amount,
      after: result.adjustment.balanceAfter,
      ledgerTransactionId: result.adjustment.ledgerTransactionId,
    },
  });
  return {
    adjustment: result.adjustment,
    duplicate: result.duplicate,
    ledgerType: type,
  };
}

async function listPayments(query) {
  const { limit, page, offset } = pageParams(query);
  const where = {};
  if (query.status) where.status = query.status;
  const result = await Payment.findAndCountAll({
    where,
    attributes: ['id', 'userId', 'amount', 'currency', 'description', 'status', 'stripePaymentIntentId', 'createdAt', 'updatedAt'],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });
  const webhookErrors = await countWhere(PaymentEvent, {
    type: { [Op.or]: [{ [Op.iLike]: '%fail%' }, { [Op.iLike]: '%error%' }] },
  });
  const rows = result.rows.map((row) => ({
    id: row.id,
    provider: 'stripe',
    providerId: row.stripePaymentIntentId || null,
    orderId: null,
    userId: row.userId,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
  return {
    ...paged({ count: result.count, rows }, page, limit),
    webhookErrors,
    retrySupported: false,
    retryNote: 'The payment service has no safe provider retry. Payments cannot be marked successful from the admin panel.',
  };
}

async function listNotifications(query) {
  const { limit, page, offset } = pageParams(query);
  const where = {};
  if (query.q) where.title = like(query.q);
  const result = await Notification.findAndCountAll({
    where,
    attributes: ['id', 'userId', 'type', 'eventType', 'title', 'isRead', 'createdAt'],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });
  const [sent, invalidTokens, delivery] = await Promise.all([
    countWhere(Notification, {}),
    countWhere(PushDevice, { [Op.or]: [{ enabled: false }, { invalidatedAt: { [Op.ne]: null } }] }),
    Promise.resolve(deliverySnapshot()),
  ]);
  return {
    ...paged({ count: result.count, rows: result.rows.map((row) => row.toJSON()) }, page, limit),
    summary: {
      sent,
      pending: null,
      pendingNote: 'No pending-delivery queue is stored. In-app notifications are written when they are created.',
      failed: null,
      recordedEmailFailures: delivery.email,
      recordedPushFailures: delivery.push,
      invalidTokens,
    },
  };
}

async function listInvalidTokens(query) {
  const { limit, page, offset } = pageParams(query);
  const result = await PushDevice.findAndCountAll({
    where: { [Op.or]: [{ enabled: false }, { invalidatedAt: { [Op.ne]: null } }] },
    attributes: ['id', 'userId', 'platform', 'enabled', 'invalidatedAt', 'lastSeenAt', 'createdAt'],
    order: [['updatedAt', 'DESC']],
    limit,
    offset,
  });
  return paged({ count: result.count, rows: result.rows.map((row) => row.toJSON()) }, page, limit);
}

async function notificationAction(admin, body) {
  const text = requireReason(body.reason);
  if (body.action === 'disable_token') {
    const device = await PushDevice.findByPk(body.id, {
      attributes: ['id', 'userId', 'platform', 'enabled', 'invalidatedAt'],
    });
    if (!device) throw httpError(404, 'Device not found');
    device.enabled = false;
    device.invalidatedAt = new Date();
    await device.save();
    await writeAudit({
      adminId: admin.id,
      action: 'PUSH_TOKEN_DISABLED',
      entity: 'push_device',
      entityId: device.id,
      result: 'success',
      reason: text,
    });
    return { ok: true };
  }
  if (body.action === 'retry') {
    const notification = await Notification.findByPk(body.id, {
      attributes: ['id', 'userId', 'title', 'message'],
    });
    if (!notification) throw httpError(404, 'Notification not found');
    const { sendPush } = require('../notifications/service');
    await sendPush(notification.userId, notification.title, notification.message, {
      type: 'admin_retry',
      notificationId: notification.id,
    });
    await writeAudit({
      adminId: admin.id,
      action: 'NOTIFICATION_RETRY',
      entity: 'notification',
      entityId: notification.id,
      result: 'success',
      reason: text,
      metadata: { duplicateNotification: false },
    });
    return { ok: true, duplicateNotification: false };
  }
  throw httpError(400, 'Unknown notification action');
}

async function listReports(query) {
  const { limit, page, offset } = pageParams(query);
  const where = {};
  const status = canonicalReportStatus(query.status);
  if (query.status && query.status !== 'all') {
    if (!status) throw httpError(400, 'Unknown report status');
    if (status === 'pending') where.status = { [Op.in]: ['pending', 'open'] };
    else where.status = status;
  }
  const result = await Report.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });
  const targetIds = result.rows
    .filter((row) => ['user', 'profile'].includes(row.targetType))
    .map((row) => row.targetId);
  const targets = targetIds.length
    ? await User.findAll({ where: { id: { [Op.in]: targetIds } }, attributes: ['id', 'role', 'firstName', 'lastName'] })
    : [];
  const byId = new Map(targets.map((row) => [row.id, row]));
  const rows = result.rows.map((row) => {
    const json = row.toJSON();
    const target = byId.get(json.targetId);
    return {
      ...json,
      targetRole: target?.role || null,
      targetName: target ? `${target.firstName || ''} ${target.lastName || ''}`.trim() : null,
      category: reportCategory({ ...json, targetRole: target?.role }),
    };
  });
  return paged({ count: result.count, rows }, page, limit);
}

async function reviewReport(admin, id, body) {
  const text = body.reason ? requireReason(body.reason) : null;
  const status = canonicalReportStatus(body.status);
  if (!status || status === 'pending') throw httpError(400, 'Status is required');
  const report = await Report.findByPk(id);
  if (!report) throw httpError(404, 'Report not found');
  report.status = status;
  report.reviewedBy = admin.id;
  report.reviewedAt = new Date();
  await report.save();
  if (body.suspend && ['user', 'profile'].includes(report.targetType)) {
    await suspendUser(report.targetId, text || 'Suspended from report review', admin.id);
  }
  await writeAudit({
    adminId: admin.id,
    action: 'REPORT_REVIEWED',
    entity: 'report',
    entityId: id,
    result: 'success',
    reason: text,
    metadata: { status, suspend: Boolean(body.suspend) },
  });
  return { ok: true, status };
}

async function listAudit(query) {
  const { limit, page, offset } = pageParams(query);
  const AdminAuditLog = require('../../models/AdminAuditLog');
  const result = await AdminAuditLog.findAndCountAll({
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });
  const adminIds = [...new Set(result.rows.map((row) => row.adminId))];
  const admins = adminIds.length
    ? await User.findAll({ where: { id: { [Op.in]: adminIds } }, attributes: ['id', 'firstName', 'lastName', 'email'] })
    : [];
  const byId = new Map(admins.map((row) => [row.id, row]));
  const rows = result.rows.map((row) => {
    const json = row.toJSON();
    const actor = byId.get(json.adminId);
    return {
      ...json,
      admin: actor ? `${actor.firstName || ''} ${actor.lastName || ''}`.trim() || actor.email : json.adminId,
    };
  });
  return paged({ count: result.count, rows }, page, limit);
}

async function userActivity(userId) {
  const user = await User.findByPk(userId, { attributes: USER_PUBLIC });
  if (!user) throw httpError(404, 'User not found');
  const Post = require('../../models/Post');
  const [posts, orders, payments] = await Promise.all([
    safe('activity.posts', () => Post.findAll({
      where: { userId },
      attributes: ['id', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: 8,
    }), []),
    safe('activity.orders', () => Order.findAll({
      where: { userId },
      attributes: ['id', 'status', 'totalAmount', 'currency', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: 8,
    }), []),
    safe('activity.payments', () => Payment.findAll({
      where: { userId },
      attributes: ['id', 'status', 'amount', 'currency', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: 8,
    }), []),
  ]);
  return {
    user,
    lastSeenAt: user.lastSeenAt,
    posts,
    orders,
    payments,
  };
}

async function trackedRevoke(admin, userId, reason) {
  const text = requireReason(reason);
  const user = await revokeSessions(userId);
  await writeAudit({
    adminId: admin.id,
    action: 'SESSIONS_REVOKED',
    entity: 'user',
    entityId: userId,
    result: 'success',
    reason: text,
  });
  return { ok: true, tokenVersion: user.tokenVersion };
}

async function systemHealth() {
  const data = await dashboard();
  return { generatedAt: data.generatedAt, status: data.status, api: data.api, today: data.today };
}

function deploymentInfo() {
  let repositoryMobileVersion = null;
  try {
    const mobilePackage = path.join(__dirname, '../../../mobile/package.json');
    if (fs.existsSync(mobilePackage)) {
      repositoryMobileVersion = JSON.parse(fs.readFileSync(mobilePackage, 'utf8')).version || null;
    }
  } catch (_err) {
    repositoryMobileVersion = null;
  }
  const connected = Boolean(process.env.RENDER_SERVICE_ID);
  return {
    frontendVersion: process.env.FRONTEND_VERSION || null,
    backendVersion: require('../../package.json').version,
    mobileVersion: process.env.MOBILE_VERSION || null,
    repositoryMobileVersion,
    gitCommit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || null,
    buildTime: process.env.BUILD_TIME || null,
    environment: process.env.NODE_ENV || 'development',
    provider: connected ? 'render' : null,
    deploymentStatus: connected ? 'CONNECTED' : 'NOT CONNECTED',
    integrationPoint: 'Set RENDER_SERVICE_ID, RENDER_GIT_COMMIT, FRONTEND_VERSION, MOBILE_VERSION and BUILD_TIME on the host. Provider credentials are not read by this endpoint.',
  };
}

async function updateFlag(admin, flag, enabled, reason) {
  const text = requireReason(reason);
  if (!FEATURE_FLAGS.includes(flag)) throw httpError(400, 'Unknown feature flag');
  await writeSetting(`flag.${flag}`, { enabled: Boolean(enabled) }, admin.id);
  await writeAudit({
    adminId: admin.id,
    action: enabled ? 'FEATURE_ENABLED' : 'FEATURE_DISABLED',
    entity: 'feature_flag',
    entityId: flag,
    result: 'success',
    reason: text,
  });
  return { flag, enabled: Boolean(enabled) };
}

async function updateMaintenance(admin, body) {
  const text = requireReason(body.reason);
  const enabled = Boolean(body.enabled);
  const message = String(body.message || 'FootballPro is under maintenance').slice(0, 300);
  const estimatedMinutes = body.estimatedMinutes == null || body.estimatedMinutes === ''
    ? null
    : Number(body.estimatedMinutes);
  if (estimatedMinutes != null && (!Number.isFinite(estimatedMinutes) || estimatedMinutes < 0)) {
    throw httpError(400, 'Estimated duration is invalid');
  }
  await writeSetting('maintenance', {
    enabled,
    message,
    estimatedMinutes,
    updatedAt: new Date().toISOString(),
  }, admin.id);
  await writeAudit({
    adminId: admin.id,
    action: enabled ? 'MAINTENANCE_ENABLED' : 'MAINTENANCE_DISABLED',
    entity: 'platform',
    entityId: 'maintenance',
    result: 'success',
    reason: text,
  });
  return getMaintenance();
}

async function bulk(admin, body) {
  const text = requireReason(body.reason);
  const action = String(body.action || '');
  const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map((id) => parseInt(id, 10)).filter((id) => id > 0))].slice(0, 100);
  if (!ids.length) throw httpError(400, 'No records selected');
  const allowed = ['verify_users', 'suspend_users', 'archive_products', 'publish_media'];
  if (!allowed.includes(action)) throw httpError(400, 'Unknown bulk action');
  const succeeded = [];
  const failed = [];
  for (const id of ids) {
    try {
      if (action === 'verify_users') await verifyUser(id);
      else if (action === 'suspend_users') await suspendUser(id, text, admin.id);
      else if (action === 'archive_products') {
        const product = await Product.findByPk(id);
        if (!product) throw httpError(404, 'Product not found');
        product.status = 'archived';
        await product.save();
      } else if (action === 'publish_media') {
        const item = await MediaItem.findByPk(id);
        if (!item) throw httpError(404, 'Media not found');
        item.visibility = 'public';
        item.publishedAt = item.publishedAt || new Date();
        await item.save();
      }
      succeeded.push(id);
    } catch (err) {
      failed.push({ id, error: err.status && err.status < 500 ? err.message : 'Failed' });
    }
  }
  await writeAudit({
    adminId: admin.id,
    action: `BULK_${action.toUpperCase()}`,
    entity: 'bulk',
    entityId: String(ids.length),
    result: failed.length ? 'partial' : 'success',
    reason: text,
    metadata: { succeeded: succeeded.length, failed: failed.length },
  });
  return { action, affected: succeeded.length, succeeded, failed };
}

async function exportRows(kind, query) {
  const columns = EXPORTS[kind];
  if (!columns) throw httpError(404, 'Unknown export');
  const where = {};
  let model = null;
  if (kind === 'users') model = User;
  else if (kind === 'players') {
    model = User;
    where.role = 'athlete';
  } else if (kind === 'orders') model = Order;
  else if (kind === 'transactions') model = JonCoinTransaction;
  else if (kind === 'reports') model = Report;
  if (kind === 'analytics') {
    const rows = await safe('export.analytics', () => sequelize.query(
      `SELECT d::date AS day,
              (SELECT COUNT(*)::int FROM "Users" u WHERE u."createdAt"::date = d::date) AS "newUsers",
              (SELECT COUNT(*)::int FROM "Orders" o WHERE o."createdAt"::date = d::date) AS "newOrders"
       FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day') d
       ORDER BY day`,
      { type: QueryTypes.SELECT }
    ), null);
    if (!rows) throw httpError(503, 'Analytics export is not available');
    return { filename: 'analytics.csv', csv: toCsv(columns, rows) };
  }
  const total = await model.count({ where });
  if (total > 2000) {
    throw httpError(413, 'Export is limited to 2000 rows. Narrow the request. Asynchronous export is not available without a job queue.');
  }
  const rows = await model.findAll({
    where,
    attributes: columns.filter((column) => model.rawAttributes[column]),
    order: [['id', 'DESC']],
    limit: 2000,
  });
  const plain = rows.map((row) => {
    const json = row.toJSON();
    const safeRow = {};
    for (const column of columns) safeRow[column] = json[column];
    return safeRow;
  });
  return { filename: `${kind}.csv`, csv: toCsv(columns, plain) };
}

async function changeAdminRole(admin, userId, adminRole, reason) {
  const text = requireReason(reason);
  const { ROLES } = require('./rbac');
  const user = await User.findByPk(userId);
  if (!user) throw httpError(404, 'User not found');
  if (user.role !== 'admin') throw httpError(400, 'Admin tiers apply only to admin accounts');
  const next = String(adminRole || '').toLowerCase();
  if (!ROLES.includes(next)) throw httpError(400, 'Unknown admin role');
  if (String(user.id) === String(admin.id) && next !== 'super_admin') {
    throw httpError(400, 'You cannot remove your own super-admin access');
  }
  user.adminRole = next;
  await user.save();
  await writeAudit({
    adminId: admin.id,
    action: 'ROLE_CHANGED',
    entity: 'user',
    entityId: userId,
    result: 'success',
    reason: text,
    metadata: { adminRole: next },
  });
  return { ok: true, adminRole: next };
}

module.exports = {
  sessionFor,
  dashboard,
  search,
  listPlayers,
  playerAction,
  listClubs,
  clubAction,
  listCompetitions,
  competitionAction,
  listMatches,
  matchAction,
  listScouting,
  listMedia,
  mediaAction,
  listProducts,
  listOrders,
  listSellers,
  productAction,
  orderAction,
  financeSummary,
  createAdjustment,
  listPayments,
  listNotifications,
  listInvalidTokens,
  notificationAction,
  listReports,
  reviewReport,
  listAudit,
  userActivity,
  trackedRevoke,
  systemHealth,
  deploymentInfo,
  updateFlag,
  updateMaintenance,
  bulk,
  exportRows,
  changeAdminRole,
  listFlags,
  listErrors,
  listJobs,
  retryJob,
};
