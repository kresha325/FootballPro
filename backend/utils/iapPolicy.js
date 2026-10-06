/**
 * Store receipts must be verified with Apple/Google.
 * A decode-only JWS or a present purchase token is not proof of payment.
 * IAP_ALLOW_UNVERIFIED is development-only and is ignored in production.
 */
function unverifiedIapAllowed(env = process.env) {
  if (env.NODE_ENV === 'production') return false;
  const flag = String(env.IAP_ALLOW_UNVERIFIED || '').trim().toLowerCase();
  return flag === 'true' || flag === '1';
}

module.exports = { unverifiedIapAllowed };
