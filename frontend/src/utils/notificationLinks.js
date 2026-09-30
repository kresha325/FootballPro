/** Normalize notification deep-links to routes the SPA actually mounts. */
export function resolveNotificationNavigatePath(notification) {
  const raw = String(notification?.link || '').trim();
  const entityType = String(notification?.entityType || '').toLowerCase();
  const entityId = notification?.entityId;
  const type = String(notification?.type || '').toLowerCase();
  const metaTid =
    notification?.metadata?.tournamentId ??
    notification?.metadata?.tournament_id ??
    null;

  const pathTournament = raw.match(/\/tournaments\/(\d+)/i);
  const queryTournament = raw.match(/[?&]tournamentId=(\d+)/i);
  const tidFromLink = queryTournament?.[1] || pathTournament?.[1] || null;

  if (tidFromLink) {
    return `/tournaments?tournamentId=${tidFromLink}`;
  }

  const tidFromEntity =
    metaTid ??
    ((type === 'tournament' || entityType === 'tournament') &&
    entityId != null &&
    String(entityId).trim() !== ''
      ? entityId
      : null);

  if (tidFromEntity != null && String(tidFromEntity).trim() !== '') {
    if (!raw || raw === '/tournaments' || /\/tournaments(\/|\?|$)/i.test(raw) || type === 'match') {
      return `/tournaments?tournamentId=${tidFromEntity}`;
    }
  }

  return raw || null;
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
