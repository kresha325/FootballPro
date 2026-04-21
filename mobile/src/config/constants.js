import Constants from 'expo-constants';

const fromExpoConfig = Constants.expoConfig?.extra?.BACKEND_URL;
const fromManifest = Constants.manifest?.extra?.BACKEND_URL;

const rawBackendUrl = (fromExpoConfig || fromManifest || 'https://footballpro.onrender.com').replace(/\/$/, '');

/**
 * Baza e axios; nëse mbaron me `/api`, thirrjet janë `baseURL` + `/api/...` (e pranuar).
 * Për skedarë statikë (uploads) nuk duhet `/api` në host — përdor `publicAssetBaseUrl()`.
 */
export const BACKEND_URL = rawBackendUrl;

/**
 * Origjina pa `/api` në fund — i njëjti server shërben `/uploads/...` në rrënjë, jo nën `/api/uploads`.
 */
export function publicAssetBaseUrl() {
  let base = (fromExpoConfig || fromManifest || 'https://footballpro.onrender.com').replace(/\/$/, '');
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
const webFromExpo = Constants.expoConfig?.extra?.WEB_APP_URL;
const webFromManifest = Constants.manifest?.extra?.WEB_APP_URL;
export const WEB_APP_URL = String(webFromExpo || webFromManifest || '').replace(/\/$/, '');
