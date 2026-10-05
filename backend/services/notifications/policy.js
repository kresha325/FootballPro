'use strict';

/** Canonical notification policy. Pure functions — no database access. */

const CATEGORIES = ['SOCIAL', 'FOOTBALL', 'SCOUTING', 'VIDEO', 'MARKETPLACE', 'WALLET', 'SYSTEM'];
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'];
const LEGACY_TYPES = ['like', 'comment', 'follow', 'message', 'mention', 'post', 'tournament', 'match', 'achievement', 'system'];

const AGGREGATE_WINDOW_MS = 15 * 60 * 1000;

/**
 * email: false never, 'optional' only when the user opted in,
 * 'default' on unless the user opted out, 'required' always (security).
 * push: false means this event is in-app only (spam control).
 * locked: security — preferences cannot turn channels off.
 */
const EVENTS = {
  FOLLOW: { category: 'SOCIAL', legacyType: 'follow', priority: 'NORMAL', email: 'optional' },
  FOLLOW_ACCEPTED: { category: 'SOCIAL', legacyType: 'follow', priority: 'NORMAL', email: 'optional' },
  POST_LIKED: { category: 'SOCIAL', legacyType: 'like', priority: 'LOW', email: false, aggregate: 'like' },
  POST_COMMENTED: { category: 'SOCIAL', legacyType: 'comment', priority: 'NORMAL', email: 'optional' },
  POST_SHARED: { category: 'SOCIAL', legacyType: 'post', priority: 'LOW', email: false, aggregate: 'share' },
  MENTION: { category: 'SOCIAL', legacyType: 'mention', priority: 'NORMAL', email: 'optional' },

  MATCH_CREATED: { category: 'FOOTBALL', legacyType: 'match', priority: 'NORMAL', email: 'optional' },
  MATCH_UPDATED: { category: 'FOOTBALL', legacyType: 'match', priority: 'NORMAL', email: false },
  MATCH_STARTING: { category: 'FOOTBALL', legacyType: 'match', priority: 'HIGH', email: 'optional' },
  MATCH_FINISHED: { category: 'FOOTBALL', legacyType: 'match', priority: 'HIGH', email: 'optional' },
  COMPETITION_UPDATE: { category: 'FOOTBALL', legacyType: 'tournament', priority: 'NORMAL', email: 'optional' },
  TOURNAMENT_UPDATE: { category: 'FOOTBALL', legacyType: 'tournament', priority: 'NORMAL', email: 'optional' },
  PLAYER_ACHIEVEMENT: { category: 'FOOTBALL', legacyType: 'achievement', priority: 'NORMAL', email: false },
  PLAYER_STATS: { category: 'FOOTBALL', legacyType: 'match', priority: 'LOW', email: false },
  PROFILE_VIEWED: { category: 'FOOTBALL', legacyType: 'system', priority: 'LOW', email: false, push: false },
  CLUB_CHANGE: { category: 'FOOTBALL', legacyType: 'system', priority: 'HIGH', email: 'default' },
  ROSTER_CHANGE: { category: 'FOOTBALL', legacyType: 'system', priority: 'HIGH', email: false },
  VERIFICATION_STATUS: { category: 'SYSTEM', legacyType: 'system', priority: 'HIGH', email: 'default' },

  SCOUT_SHORTLISTED: { category: 'SCOUTING', legacyType: 'system', priority: 'NORMAL', email: false },
  SCOUT_WATCHLIST: { category: 'SCOUTING', legacyType: 'system', priority: 'NORMAL', email: false },
  SCOUT_REPORT: { category: 'SCOUTING', legacyType: 'system', priority: 'LOW', email: false, push: false },
  SCOUT_PERFORMANCE: { category: 'SCOUTING', legacyType: 'system', priority: 'NORMAL', email: false },
  SCOUT_FOLLOW_UP: { category: 'SCOUTING', legacyType: 'system', priority: 'NORMAL', email: 'optional' },
  SCOUT_RECOMMENDATION: { category: 'SCOUTING', legacyType: 'system', priority: 'LOW', email: false, push: false },

  STREAM_STARTING: { category: 'VIDEO', legacyType: 'system', priority: 'HIGH', email: false },
  STREAM_STARTED: { category: 'VIDEO', legacyType: 'system', priority: 'HIGH', email: false },
  STREAM_ENDED: { category: 'VIDEO', legacyType: 'system', priority: 'LOW', email: false, push: false },
  REPLAY_AVAILABLE: { category: 'VIDEO', legacyType: 'system', priority: 'NORMAL', email: false },
  HIGHLIGHT_UPLOADED: { category: 'VIDEO', legacyType: 'post', priority: 'NORMAL', email: false },
  MATCH_VIDEO: { category: 'VIDEO', legacyType: 'match', priority: 'NORMAL', email: false },

  ORDER_CREATED: { category: 'MARKETPLACE', legacyType: 'system', priority: 'HIGH', email: 'default' },
  ORDER_ACCEPTED: { category: 'MARKETPLACE', legacyType: 'system', priority: 'HIGH', email: 'default' },
  ORDER_SHIPPED: { category: 'MARKETPLACE', legacyType: 'system', priority: 'HIGH', email: 'default' },
  ORDER_COMPLETED: { category: 'MARKETPLACE', legacyType: 'system', priority: 'NORMAL', email: 'default' },
  ORDER_CANCELLED: { category: 'MARKETPLACE', legacyType: 'system', priority: 'HIGH', email: 'default' },
  PAYMENT_STATUS: { category: 'MARKETPLACE', legacyType: 'system', priority: 'HIGH', email: 'default' },
  REFUND: { category: 'MARKETPLACE', legacyType: 'system', priority: 'HIGH', email: 'default' },

  WALLET_TRANSACTION: { category: 'WALLET', legacyType: 'system', priority: 'NORMAL', email: 'optional' },
  WALLET_RECEIVED: { category: 'WALLET', legacyType: 'system', priority: 'HIGH', email: 'default' },
  WALLET_SPENT: { category: 'WALLET', legacyType: 'system', priority: 'NORMAL', email: 'optional' },
  WALLET_WITHDRAWAL: { category: 'WALLET', legacyType: 'system', priority: 'HIGH', email: 'default' },
  WALLET_REFUND: { category: 'WALLET', legacyType: 'system', priority: 'HIGH', email: 'default' },

  SECURITY_ALERT: { category: 'SYSTEM', legacyType: 'system', priority: 'CRITICAL', email: 'required', locked: true, allowSelf: true },
  PASSWORD_CHANGED: { category: 'SYSTEM', legacyType: 'system', priority: 'CRITICAL', email: 'required', locked: true, allowSelf: true },
  EMAIL_VERIFICATION: { category: 'SYSTEM', legacyType: 'system', priority: 'CRITICAL', email: 'required', locked: true, allowSelf: true },
  PLATFORM_ANNOUNCEMENT: { category: 'SYSTEM', legacyType: 'system', priority: 'HIGH', email: 'default' },
  SYSTEM_NOTICE: { category: 'SYSTEM', legacyType: 'system', priority: 'NORMAL', email: false },
  MESSAGE: { category: 'SYSTEM', legacyType: 'message', priority: 'NORMAL', email: false, bell: false },
};

const LEGACY_EVENT = {
  like: 'POST_LIKED',
  comment: 'POST_COMMENTED',
  follow: 'FOLLOW',
  mention: 'MENTION',
  post: 'POST_SHARED',
  tournament: 'TOURNAMENT_UPDATE',
  match: 'MATCH_UPDATED',
  achievement: 'PLAYER_ACHIEVEMENT',
  message: 'MESSAGE',
  system: 'SYSTEM_NOTICE',
};

function eventDef(eventType) {
  return EVENTS[eventType] || null;
}

function defaultPreference(category) {
  const email = category === 'MARKETPLACE' || category === 'WALLET' || category === 'SYSTEM';
  return { category, inApp: true, push: true, email, locked: false };
}

function emailChannel(def, pref) {
  if (!def || def.email === false) return false;
  if (def.email === 'required' || def.locked) return true;
  if (def.email === 'default') return pref.email !== false;
  if (def.email === 'optional') return pref.email === true;
  return false;
}

function deliveryDecision(eventType, preference) {
  const def = eventDef(eventType) || EVENTS.SYSTEM_NOTICE;
  const pref = preference || defaultPreference(def.category);
  if (def.locked) {
    return { inApp: true, push: true, email: true, priority: 'CRITICAL', locked: true, bell: def.bell !== false };
  }
  const push = def.push === false ? false : pref.push !== false;
  const inApp = pref.inApp !== false;
  return {
    inApp,
    push,
    email: emailChannel(def, pref),
    priority: PRIORITIES.includes(def.priority) ? def.priority : 'NORMAL',
    locked: false,
    bell: def.bell !== false,
  };
}

function anyChannel(decision) {
  return Boolean(decision && (decision.inApp || decision.push || decision.email));
}

function legacyTypeFor(eventType, fallback) {
  const def = eventDef(eventType);
  if (def?.legacyType && LEGACY_TYPES.includes(def.legacyType)) return def.legacyType;
  if (LEGACY_TYPES.includes(fallback)) return fallback;
  return 'system';
}

function resolveEventType(input = {}) {
  if (input.eventType && EVENTS[input.eventType]) return input.eventType;
  if (input.metadata?.type === 'missed_call') return 'SYSTEM_NOTICE';
  if (input.type && LEGACY_EVENT[input.type]) return LEGACY_EVENT[input.type];
  return 'SYSTEM_NOTICE';
}

function buildEntityLink({ entityType, entityId, link, metadata } = {}) {
  if (link) return link;
  const type = String(entityType || metadata?.entityType || '').toLowerCase();
  const id = entityId != null ? entityId : metadata?.entityId;
  switch (type) {
    case 'match':
      return id ? `/matches/${id}` : '/matches';
    case 'player':
    case 'user':
    case 'club':
      return id ? `/profile/${id}` : '/profiles';
    case 'post':
      return id ? `/feed?post=${id}` : '/feed';
    case 'stream':
      return id ? `/live/${id}` : '/live';
    case 'media':
      return id ? `/videos?media=${id}` : '/videos';
    case 'order':
      return id ? `/marketplace?order=${id}` : '/marketplace';
    case 'wallet':
    case 'transaction':
      return '/wallet';
    case 'scouting':
      return '/scouting';
    case 'tournament':
    case 'competition':
      return id ? `/tournaments?tournamentId=${id}` : '/tournaments';
    default:
      return null;
  }
}

function idempotencyKey(parts) {
  const key = (Array.isArray(parts) ? parts : [])
    .filter((part) => part != null && String(part).trim() !== '')
    .map((part) => String(part).trim())
    .join(':');
  return key ? key.slice(0, 191) : null;
}

function aggregateCopy(kind, count, actorName) {
  const n = Number(count) || 1;
  const name = actorName || 'Dikush';
  if (kind === 'share') {
    if (n <= 1) return `${name} shpërndau postimin tuaj`;
    return `Postimi juaj u shpërnda ${n} herë.`;
  }
  if (n <= 1) return `${name} pëlqeu postimin tuaj`;
  return `Postimi juaj mori ${n} pëlqime të reja.`;
}

function withinAggregateWindow(createdAt, now = new Date()) {
  const ts = new Date(createdAt).getTime();
  if (!Number.isFinite(ts)) return false;
  return now.getTime() - ts <= AGGREGATE_WINDOW_MS;
}

function pushPriority(priority) {
  return priority === 'HIGH' || priority === 'CRITICAL' ? 'high' : 'default';
}

function parseListQuery(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  let limit = parseInt(query.limit, 10) || 20;
  if (!Number.isFinite(limit) || limit < 1) limit = 20;
  if (limit > 50) limit = 50;
  const unreadOnly = query.unreadOnly === true || query.unreadOnly === 'true' || query.unread === 'true';
  const category = CATEGORIES.includes(String(query.category || '').toUpperCase())
    ? String(query.category).toUpperCase()
    : null;
  return { page, limit, offset: (page - 1) * limit, unreadOnly, category };
}

function sanitizePreferences(body) {
  const rows = Array.isArray(body) ? body : body?.preferences;
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, msg: 'preferences është e detyrueshme' };
  }
  const byCategory = new Map();
  for (const row of rows) {
    const category = String(row?.category || '').toUpperCase();
    if (!CATEGORIES.includes(category)) {
      return { ok: false, msg: `Kategori e pavlefshme: ${row?.category || ''}` };
    }
    byCategory.set(category, {
      category,
      inApp: row.inApp !== false,
      push: row.push !== false,
      email: Boolean(row.email),
      locked: false,
    });
  }
  return { ok: true, preferences: [...byCategory.values()] };
}

function preferenceView(storedRows) {
  const byCategory = new Map((storedRows || []).map((row) => [row.category, row]));
  return CATEGORIES.map((category) => {
    const base = defaultPreference(category);
    const stored = byCategory.get(category);
    if (!stored) return base;
    return {
      category,
      inApp: stored.inApp !== false,
      push: stored.push !== false,
      email: Boolean(stored.email),
      locked: false,
    };
  });
}

function presentNotification(row) {
  const n = row?.toJSON ? row.toJSON() : { ...(row || {}) };
  const metadata = n.metadata && typeof n.metadata === 'object' ? n.metadata : null;
  return {
    id: n.id,
    userId: n.userId,
    actorId: n.actorId || null,
    actor: n.actor || null,
    type: n.type,
    eventType: n.eventType || metadata?.eventType || null,
    category: n.category || metadata?.category || null,
    priority: n.priority || metadata?.priority || 'NORMAL',
    title: n.title,
    message: n.message,
    link: n.link || null,
    entityType: n.entityType || null,
    entityId: n.entityId != null ? n.entityId : null,
    data: metadata,
    metadata,
    isRead: Boolean(n.isRead),
    readAt: n.readAt || null,
    expiresAt: n.expiresAt || null,
    createdAt: n.createdAt || null,
    aggregated: Boolean(n.aggregated),
  };
}

function isSchemaGap(err) {
  const message = String(err?.original?.message || err?.parent?.message || err?.message || '');
  return /does not exist|no such column|unknown column|no column named/i.test(message);
}

function isUniqueViolation(err) {
  return err?.name === 'SequelizeUniqueConstraintError' || err?.original?.code === '23505';
}

function activeExpiry(now = new Date()) {
  return now;
}

function buildMatchNotice({ match, tournament, userId, kind }) {
  const matchId = Number(match?.id);
  const tournamentId = Number(match?.tournamentId || tournament?.id);
  const tournamentName = tournament?.name || (tournamentId ? `Turneu #${tournamentId}` : 'Turneu');
  const when = match?.matchDate ? new Date(match.matchDate) : null;
  const dateLabel = when && !Number.isNaN(when.getTime())
    ? when.toLocaleString('sq-AL', { dateStyle: 'medium', timeStyle: 'short' })
    : 'datë e caktuar';
  const home = match?.scoreHome;
  const away = match?.scoreAway;
  const hasScore = home != null && away != null && !Number.isNaN(Number(home)) && !Number.isNaN(Number(away));
  const finished = ['finished', 'completed', 'walkover'].includes(String(match?.status || '').toLowerCase()) || (kind === 'stats' && hasScore);

  let eventType = 'MATCH_UPDATED';
  let title = 'Ndeshje e përditësuar';
  let message = `Në «${tournamentName}» u ndryshua ndeshja: ${dateLabel}.`;
  let keyBucket = when && !Number.isNaN(when.getTime()) ? when.toISOString() : 'updated';
  let expiresAt = null;
  let priority = 'NORMAL';

  if (kind === 'starting') {
    eventType = 'MATCH_STARTING';
    title = 'Ndeshja po fillon';
    message = `Ndeshja në «${tournamentName}» fillon së shpejti (${dateLabel}).`;
    keyBucket = kind === 'starting' && match?.reminderWindow ? match.reminderWindow : 'start';
    expiresAt = when && !Number.isNaN(when.getTime()) ? when : null;
    priority = 'HIGH';
  } else if (kind === 'created') {
    eventType = 'MATCH_CREATED';
    title = 'Ndeshje e planifikuar';
    message = `Në «${tournamentName}» u planifikua një ndeshje për ${dateLabel}.`;
    keyBucket = 'created';
  } else if (finished) {
    eventType = 'MATCH_FINISHED';
    title = 'Rezultati i ndeshjes';
    message = hasScore
      ? `Ndeshja në «${tournamentName}» përfundoi ${Number(home)}–${Number(away)}.`
      : `Ndeshja në «${tournamentName}» përfundoi.`;
    keyBucket = hasScore ? `${Number(home)}-${Number(away)}` : 'finished';
    priority = 'HIGH';
  }

  return {
    userId,
    eventType,
    type: 'match',
    category: 'FOOTBALL',
    priority,
    title,
    message,
    link: matchId ? `/matches/${matchId}` : '/matches',
    entityType: 'match',
    entityId: matchId || null,
    expiresAt,
    idempotencyKey: idempotencyKey(['match', matchId || 'x', eventType, keyBucket, 'user', userId]),
    metadata: {
      tournamentId: Number.isFinite(tournamentId) ? tournamentId : null,
      kind: kind || 'updated',
    },
  };
}

function orderEventForStatus(status) {
  switch (String(status || '').toLowerCase()) {
    case 'pending':
    case 'payment_pending':
      return 'ORDER_CREATED';
    case 'processing':
      return 'PAYMENT_STATUS';
    case 'failed':
      return 'ORDER_CANCELLED';
    case 'paid':
    case 'accepted':
      return 'ORDER_ACCEPTED';
    case 'shipped':
      return 'ORDER_SHIPPED';
    case 'delivered':
    case 'completed':
      return 'ORDER_COMPLETED';
    case 'cancelled':
    case 'rejected':
      return 'ORDER_CANCELLED';
    case 'refunded':
      return 'REFUND';
    default:
      return 'PAYMENT_STATUS';
  }
}

function walletEventFor(tx) {
  const type = String(tx?.type || '').toLowerCase();
  const status = String(tx?.status || '').toLowerCase();
  if (type === 'withdrawal') return 'WALLET_WITHDRAWAL';
  if (type === 'refund') return 'WALLET_REFUND';
  if (type === 'sale' || type === 'reward' || type === 'purchase' || type === 'refund') return 'WALLET_RECEIVED';
  if (type === 'spend' || type === 'commission' || type === 'fee' || type === 'subscription' || type === 'reversal') return 'WALLET_SPENT';
  if (status === 'rejected') return 'WALLET_TRANSACTION';
  return 'WALLET_TRANSACTION';
}

module.exports = {
  CATEGORIES,
  PRIORITIES,
  LEGACY_TYPES,
  EVENTS,
  AGGREGATE_WINDOW_MS,
  eventDef,
  defaultPreference,
  deliveryDecision,
  anyChannel,
  legacyTypeFor,
  resolveEventType,
  buildEntityLink,
  idempotencyKey,
  aggregateCopy,
  withinAggregateWindow,
  pushPriority,
  parseListQuery,
  sanitizePreferences,
  preferenceView,
  presentNotification,
  isSchemaGap,
  isUniqueViolation,
  activeExpiry,
  buildMatchNotice,
  orderEventForStatus,
  walletEventFor,
};
