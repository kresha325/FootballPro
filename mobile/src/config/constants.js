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

/** URL e frontend-it (Vite) për WebView thirrjeje — /embed-call. Zbrazët nëse nuk është konfiguruar. */
const rawWebAppUrl = String(appExtra.WEB_APP_URL || 'https://footballpro.al').replace(/\/$/, '');
/** Frontend Vite (embed-call, live player). Override via app.json extra or WEB_APP_URL env. */
export const WEB_APP_URL = rawWebAppUrl;
