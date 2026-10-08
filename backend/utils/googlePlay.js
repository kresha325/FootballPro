const crypto = require('crypto');

/**
 * Verifies Google Play (Android) in-app purchase tokens via the Android
 * Publisher API, mirroring the cryptographic rigor already applied to Apple
 * purchases in utils/appleJws.js.
 *
 * Requires a Google Cloud service account (Play Console → Setup → API access)
 * with the "View financial data" permission, provided as GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
 * (the full service-account JSON key, as a single-line string).
 *
 * Auth flow (RFC 7523 JWT-bearer grant): we sign a short-lived JWT assertion
 * with the service account's RSA private key and exchange it at Google's
 * OAuth2 token endpoint for a bearer access token, then call the Android
 * Publisher REST API directly (no googleapis/google-auth-library dependency
 * needed — Node 20's built-in crypto + fetch are sufficient).
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const PUBLISHER_BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const DEFAULT_PACKAGE_NAME = 'com.kresha325.xtalenti';

// Cached per-process; Google access tokens are valid for ~1h.
let cachedToken = null;

function getServiceAccount(env = process.env) {
  const raw = env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.client_email || !parsed?.private_key) return null;
    return parsed;
  } catch {
    return null;
  }
}

function getPackageName(env = process.env) {
  return env.GOOGLE_PLAY_PACKAGE_NAME || DEFAULT_PACKAGE_NAME;
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Builds the unsigned claims for the OAuth2 JWT-bearer assertion. Exported for testing. */
function buildAssertionClaims(serviceAccount, nowSeconds = Math.floor(Date.now() / 1000)) {
  return {
    iss: serviceAccount.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };
}

function signAssertion(serviceAccount, claims) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(serviceAccount.private_key);
  return `${unsigned}.${base64url(signature)}`;
}

async function fetchAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.accessToken;
  }
  const assertion = signAssertion(serviceAccount, buildAssertionClaims(serviceAccount, now));
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`Google OAuth2 token exchange failed: ${data.error_description || data.error || res.status}`);
  }
  cachedToken = { accessToken: data.access_token, expiresAt: now + (Number(data.expires_in) || 3600) };
  return cachedToken.accessToken;
}

/** Interprets a `purchases.products.get` response. Pure/testable. */
function interpretProductPurchase(data) {
  if (!data) return { ok: false, msg: 'Përgjigje bosh nga Google Play' };
  // purchaseState: 0 = purchased, 1 = canceled, 2 = pending
  if (data.purchaseState !== 0) {
    return { ok: false, msg: `Blerja nuk është e përfunduar (purchaseState=${data.purchaseState})` };
  }
  return { ok: true, raw: data };
}

/** Interprets a `purchases.subscriptions.get` response. Pure/testable. */
function interpretSubscriptionPurchase(data) {
  if (!data) return { ok: false, msg: 'Përgjigje bosh nga Google Play' };
  // paymentState: 0 = pending, 1 = received, 2 = free trial, 3 = pending deferred upgrade/downgrade
  if (![1, 2, 3].includes(data.paymentState)) {
    return { ok: false, msg: `Abonimi nuk është aktiv (paymentState=${data.paymentState})` };
  }
  const expiryMs = Number(data.expiryTimeMillis || 0);
  if (expiryMs && expiryMs < Date.now()) {
    return { ok: false, msg: 'Abonimi ka skaduar' };
  }
  return { ok: true, raw: data };
}

async function callAndroidPublisher(path, env) {
  const serviceAccount = getServiceAccount(env);
  const token = await fetchAccessToken(serviceAccount);
  const res = await fetch(`${PUBLISHER_BASE}/${encodeURIComponent(getPackageName(env))}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, msg: data?.error?.message || `Google Play API ${res.status}` };
  }
  return { ok: true, data };
}

/**
 * Verifies a Google Play purchase token against the Android Publisher API.
 * Returns { ok:false, msg:'not_configured' } when no service account is set,
 * so callers can decide whether to fall back to the dev-only unverified path.
 */
async function verifyGooglePlayPurchase({ productId, purchaseToken, isSubscription }, env = process.env) {
  if (!purchaseToken || !productId) {
    return { ok: false, msg: 'purchaseToken / productId mungojnë' };
  }
  if (!getServiceAccount(env)) {
    return { ok: false, msg: 'not_configured' };
  }

  const path = isSubscription
    ? `/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`
    : `/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;

  try {
    const result = await callAndroidPublisher(path, env);
    if (!result.ok) return result;
    return isSubscription ? interpretSubscriptionPurchase(result.data) : interpretProductPurchase(result.data);
  } catch (err) {
    return { ok: false, msg: err?.message || 'Verifikimi me Google Play dështoi' };
  }
}

module.exports = {
  verifyGooglePlayPurchase,
  interpretProductPurchase,
  interpretSubscriptionPurchase,
  buildAssertionClaims,
  getServiceAccount,
  getPackageName,
};
