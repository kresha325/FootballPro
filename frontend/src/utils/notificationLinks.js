/** Normalize notification deep-links to routes the SPA actually mounts. */
const ENTITY_ROUTES = {
  match: (id) => (id ? `/matches/${id}` : '/matches'),
  player: (id) => (id ? `/profile/${id}` : '/profiles'),
  user: (id) => (id ? `/profile/${id}` : '/profiles'),
  club: (id) => (id ? `/profile/${id}` : '/profiles'),
  post: (id) => (id ? `/feed?post=${id}` : '/feed'),
  stream: (id) => (id ? `/live/${id}` : '/live'),
  media: (id) => (id ? `/videos?media=${id}` : '/videos'),
  order: (id) => (id ? `/marketplace?order=${id}` : '/marketplace'),
  wallet: () => '/wallet',
  transaction: () => '/wallet',
  scouting: () => '/scouting',
  tournament: (id) => (id ? `/tournaments?tournamentId=${id}` : '/tournaments'),
  competition: (id) => (id ? `/tournaments?tournamentId=${id}` : '/tournaments'),
};

export function resolveNotificationNavigatePath(notification) {
  const raw = String(notification?.link || '').trim();
  const entityType = String(notification?.entityType || notification?.data?.entityType || '').toLowerCase();
  const entityId = notification?.entityId;
  const type = String(notification?.type || '').toLowerCase();
  const eventType = String(notification?.eventType || notification?.metadata?.eventType || '').toUpperCase();
  const metaTid =
    notification?.metadata?.tournamentId ??
    notification?.metadata?.tournament_id ??
    null;

  if (entityType && ENTITY_ROUTES[entityType] && entityType !== 'tournament' && entityType !== 'competition') {
    if (entityType === 'post' && raw) return raw.startsWith('/feed') ? raw : ENTITY_ROUTES.post(entityId);
    if (entityType !== 'post') return ENTITY_ROUTES[entityType](entityId);
  }

  if (eventType.startsWith('MATCH_') && entityId) return `/matches/${entityId}`;
  if (eventType.startsWith('STREAM_') || eventType === 'REPLAY_AVAILABLE') {
    return entityId ? `/live/${entityId}` : '/live';
  }
  if (eventType.startsWith('ORDER_') || eventType === 'REFUND' || eventType === 'PAYMENT_STATUS') {
    return entityId ? `/marketplace?order=${entityId}` : '/marketplace';
  }
  if (eventType.startsWith('WALLET_')) return '/wallet';
  if (eventType.startsWith('SCOUT_')) return '/scouting';

  const pathTournament = raw.match(/\/tournaments\/(\d+)/i);
  const queryTournament = raw.match(/[?&]tournamentId=(\d+)/i);
  const tidFromLink = queryTournament?.[1] || pathTournament?.[1] || null;

  if (tidFromLink) {
    return `/tournaments?tournamentId=${tidFromLink}`;
  }

  const tidFromEntity =
    metaTid ??
    ((type === 'tournament' || entityType === 'tournament' || entityType === 'competition') &&
    entityId != null &&
    String(entityId).trim() !== ''
      ? entityId
      : null);

  if (tidFromEntity != null && String(tidFromEntity).trim() !== '') {
    if (!raw || raw === '/tournaments' || /\/tournaments(\/|\?|$)/i.test(raw) || type === 'match' || eventType.startsWith('MATCH_') === false) {
      if (eventType.startsWith('MATCH_') && entityId) return `/matches/${entityId}`;
      return `/tournaments?tournamentId=${tidFromEntity}`;
    }
  }

  if (raw) return raw;
  if (ENTITY_ROUTES[entityType]) return ENTITY_ROUTES[entityType](entityId);
  return null;
}

export function tournamentIdFromNotification(notification) {
  const path = resolveNotificationNavigatePath(notification) || '';
  const q = path.match(/[?&]tournamentId=(\d+)/i)?.[1];
  if (q) return Number(q);
  const p = String(notification?.link || '').match(/\/tournaments\/(\d+)/i)?.[1];
  if (p) return Number(p);
  const meta =
    notification?.metadata?.tournamentId ?? notification?.metadata?.tournament_id;
  if (meta != null && String(meta).trim() !== '') return Number(meta);
  if (
    (notification?.entityType === 'tournament' || notification?.type === 'tournament') &&
    notification?.entityId != null
  ) {
    return Number(notification.entityId);
  }
  return null;
}
