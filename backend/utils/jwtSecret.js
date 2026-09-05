/**
 * JWT secret resolution.
 * Production must have JWT_SECRET set — never fall back to a hardcoded value.
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && String(secret).trim()) {
    return String(secret).trim();
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }

  console.warn('[security] JWT_SECRET missing — using insecure dev fallback. Set JWT_SECRET.');
  return 'dev_jwt_secret';
}

module.exports = { getJwtSecret };
