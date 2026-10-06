/**
 * Browser CORS policy.
 * Requests with no Origin (mobile apps, server-to-server) stay allowed.
 * Production does not trust localhost or a wildcard with credentials.
 */

const PRODUCTION_ORIGINS = ['https://xtalenti.com', 'https://www.xtalenti.com'];

const DEVELOPMENT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:4173',
];

function normalizeOrigin(value) {
  return String(value || '')
    .trim()
    .replace(/\/$/, '');
}

function buildAllowedOrigins(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const fromEnv = [env.CORS_ORIGIN, env.FRONTEND_URL]
    .filter(Boolean)
    .join(',')
    .split(',')
    .map(normalizeOrigin)
    .filter((origin) => origin && origin !== '*');

  const defaults = nodeEnv === 'production'
    ? PRODUCTION_ORIGINS
    : [...PRODUCTION_ORIGINS, ...DEVELOPMENT_ORIGINS];

  return [...new Set([...defaults, ...fromEnv])];
}

function isAllowedOrigin(origin, env = process.env, allowedOrigins = buildAllowedOrigins(env)) {
  if (!origin) return true;
  if ((env.NODE_ENV || 'development') !== 'production') return true;
  return allowedOrigins.includes(normalizeOrigin(origin));
}

module.exports = {
  PRODUCTION_ORIGINS,
  DEVELOPMENT_ORIGINS,
  normalizeOrigin,
  buildAllowedOrigins,
  isAllowedOrigin,
};
