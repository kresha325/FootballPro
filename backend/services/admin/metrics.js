'use strict';

/** In-process API counters. They reset when the process restarts. No request bodies are stored. */

const WINDOW_MS = {
  '5m': 5 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};

const buckets = new Map();

function normalizePath(path) {
  return String(path || '/')
    .split('?')[0]
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '/:id')
    .replace(/\/\d+/g, '/:id')
    .slice(0, 180) || '/';
}

function minuteKey(now) {
  return Math.floor(now / 60000);
}

function prune(now) {
  const oldest = minuteKey(now - WINDOW_MS['24h'] - 60000);
  for (const key of buckets.keys()) {
    if (key < oldest) buckets.delete(key);
  }
}

function recordRequest({ method = 'GET', path = '/', status = 200, durationMs = 0, now = Date.now() } = {}) {
  const key = minuteKey(now);
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { count: 0, errors: 0, latencySum: 0, routes: new Map() };
    buckets.set(key, bucket);
  }
  const failed = Number(status) >= 500;
  bucket.count += 1;
  if (failed) bucket.errors += 1;
  const latency = Number(durationMs);
  if (Number.isFinite(latency) && latency >= 0) bucket.latencySum += latency;

  const routeKey = `${String(method || 'GET').toUpperCase()} ${normalizePath(path)}`;
  const route = bucket.routes.get(routeKey) || { count: 0, errors: 0, latencySum: 0 };
  route.count += 1;
  if (failed) route.errors += 1;
  if (Number.isFinite(latency) && latency >= 0) route.latencySum += latency;
  if (bucket.routes.size < 80 || bucket.routes.has(routeKey)) {
    bucket.routes.set(routeKey, route);
  }
  prune(now);
}

function summarize(windowName, now = Date.now()) {
  const span = WINDOW_MS[windowName];
  if (!span) return null;
  const from = minuteKey(now - span);
  let count = 0;
  let errors = 0;
  let latencySum = 0;
  const routes = new Map();
  for (const [key, bucket] of buckets) {
    if (key < from) continue;
    count += bucket.count;
    errors += bucket.errors;
    latencySum += bucket.latencySum;
    for (const [routeKey, route] of bucket.routes) {
      const acc = routes.get(routeKey) || { count: 0, errors: 0, latencySum: 0 };
      acc.count += route.count;
      acc.errors += route.errors;
      acc.latencySum += route.latencySum;
      routes.set(routeKey, acc);
    }
  }
  const endpoints = [...routes.entries()]
    .map(([endpoint, route]) => ({
      endpoint,
      count: route.count,
      errors: route.errors,
      errorRate: route.count ? route.errors / route.count : 0,
      avgLatencyMs: route.count ? Math.round(route.latencySum / route.count) : 0,
    }))
    .filter((row) => row.errors > 0)
    .sort((a, b) => b.errors - a.errors || b.errorRate - a.errorRate)
    .slice(0, 8);
  return {
    window: windowName,
    scope: 'process',
    requests: count,
    errors,
    errorRate: count ? errors / count : 0,
    avgLatencyMs: count ? Math.round(latencySum / count) : null,
    problematicEndpoints: endpoints,
  };
}

function snapshot(now = Date.now()) {
  return {
    scope: 'process',
    note: 'Counts cover this API process since startup, capped at 24 hours. They are not estimated.',
    windows: {
      '5m': summarize('5m', now),
      '1h': summarize('1h', now),
      '24h': summarize('24h', now),
    },
  };
}

function resetMetrics() {
  buckets.clear();
}

module.exports = {
  normalizePath,
  recordRequest,
  summarize,
  snapshot,
  resetMetrics,
};
