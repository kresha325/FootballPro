const listeners = new Set();

/** @param {{ xp?: number, reason?: string, levelUp?: { oldLevel: number, newLevel: number } | null }} payload */
export function showXpNotification(xp = 0, reason = '', levelUp = null) {
  const payload = { xp, reason, levelUp };
  listeners.forEach((fn) => {
    try {
      fn(payload);
    } catch (e) {
      console.warn('xp notification listener error:', e?.message);
    }
  });
}

export function subscribeXpNotifications(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
