'use strict';

/**
 * Short in-process cache for expensive read models.
 * Financial balances are not stored here.
 * Match and money aggregates expire within seconds so a finished match
 * or a settled order cannot stay stale.
 */

const store = new Map();

const TTL = {
  social: 60 * 1000,
  player: 60 * 1000,
  club: 60 * 1000,
  competition: 45 * 1000,
  scouting: 60 * 1000,
  video: 60 * 1000,
  marketplace: 15 * 1000,
  walletActivity: 15 * 1000,
};

function get(key) {
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.expires <= Date.now()) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

function set(key, value, ttlMs) {
  store.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

async function remember(key, ttlMs, loader) {
  const hit = get(key);
  if (hit) return hit;
  const value = await loader();
  return set(key, value, ttlMs);
}

function invalidate(prefix) {
  const needle = String(prefix || '');
  for (const key of store.keys()) {
    if (!needle || key.startsWith(needle)) store.delete(key);
  }
}

module.exports = {
  TTL,
  get,
  set,
  remember,
  invalidate,
};
