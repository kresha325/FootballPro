import Constants from 'expo-constants';

/** app.json `extra` — mos përdor Constants.manifest (deprecated në SDK 49+). */
const appExtra = Constants.expoConfig?.extra ?? {};

const rawBackendUrl = (appExtra.BACKEND_URL || 'https://footballpro.onrender.com').replace(/\/$/, '');

/**
 * Baza e axios; nëse mbaron me `/api`, thirrjet janë `baseURL` + `/api/...` (e pranuar).
 * Për skedarë statikë (uploads) nuk duhet `/api` në host — përdor `publicAssetBaseUrl()`.
 */
export const BACKEND_URL = rawBackendUrl;

/**
 * Origjina pa `/api` në fund — i njëjti server shërben `/uploads/...` në rrënjë, jo nën `/api/uploads`.
 */
export function publicAssetBaseUrl() {
  let base = (appExtra.BACKEND_URL || 'https://footballpro.onrender.com').replace(/\/$/, '');
  if (base.toLowerCase().endsWith('/api')) {
    base = base.slice(0, -4);
  }
  return base;
}

/**
 * Për fusha si imageUrl nga API që vijnë si `/uploads/...` (pa host), ose kur BACKEND ka `/api` gabimisht.
 * React Native `Image` kërkon URL absolut.
 */
export function absoluteBackendUrl(maybePath) {
  if (maybePath == null || typeof maybePath !== 'string') return null;
  const s = maybePath.trim();
  if (!s) return null;
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (s.startsWith('file:') || s.startsWith('content:') || s.startsWith('blob:')) return s;
  const path = s.startsWith('/') ? s : `/${s}`;
  if (path.startsWith('/api/uploads/')) {
    return `${publicAssetBaseUrl()}${path.replace(/^\/api/, '')}`;
  }
  return `${publicAssetBaseUrl()}${path}`;
}

/** Frontend Vite (embed-call, embed-go-live, /live). */
function resolveWebAppUrl() {
  let configured = String(
    appExtra.WEB_APP_URL || 'https://xtalenti.com'
  ).replace(/\/$/, '');
  const devOverride = process.env.EXPO_PUBLIC_WEB_APP_URL || process.env.WEB_APP_URL;
  if (typeof __DEV__ !== 'undefined' && __DEV__ && devOverride) {
    configured = String(devOverride).replace(/\/$/, '');
  }
  // Legacy hostnames → canonical GitHub Pages domain
  if (/^(www\.)?(footballpro\.al|footballpro-1\.onrender\.com)$/i.test(configured.replace(/^https?:\/\//, ''))) {
    return 'https://xtalenti.com';
  }
  return configured;
}

export const WEB_APP_URL = resolveWebAppUrl();

/**
 * Digital goods via StoreKit / Play Billing (expo-iap).
 * When true, Premium/JonCoin use IAP; Stripe checkout is not used for those in mobile.
 */
export const ALLOW_MOBILE_DIGITAL_PURCHASES = appExtra.ALLOW_MOBILE_DIGITAL_PURCHASES === true;
