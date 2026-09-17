/**
 * Human-readable last-seen / presence label (sq).
 */
export function formatPresenceLabel({ online, lastSeenAt, typing } = {}) {
  if (typing) return 'po shkruan…';
  if (online) return 'Online';

  if (!lastSeenAt) return 'Offline';

  const then = lastSeenAt instanceof Date ? lastSeenAt : new Date(lastSeenAt);
  if (Number.isNaN(then.getTime())) return 'Offline';

  const now = Date.now();
  const diffMs = Math.max(0, now - then.getTime());
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (mins < 1) return 'Ishte online sapo';
  if (mins < 60) return `Ishte online para ${mins} min`;
  if (hours < 24) return `Ishte online para ${hours} orë`;
  if (days === 1) return 'Ishte online dje';
  if (days < 7) return `Ishte online para ${days} ditësh`;

  try {
    const label = then.toLocaleString('sq-AL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    return `Ishte online ${label}`;
  } catch {
    return 'Offline';
  }
}
