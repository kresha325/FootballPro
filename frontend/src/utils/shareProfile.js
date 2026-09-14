import { APP_BRAND_NAME } from '../config/branding';

function apiOrigin() {
  const env = import.meta.env?.VITE_API_URL;
  if (env && typeof env === 'string' && env.length) {
    return String(env).replace(/\/api\/?$/, '').replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:10000';
  }
  return 'https://footballpro.onrender.com';
}

function webOrigin(origin) {
  return String(origin || (typeof window !== 'undefined' ? window.location.origin : 'https://xtalenti.com')).replace(
    /\/$/,
    ''
  );
}

/** Public SPA page humans open. */
export function getProfileCvPublicUrl(userId, origin) {
  return `${webOrigin(origin)}/cv/${userId}`;
}

/**
 * URL for social crawlers (Facebook/WhatsApp) — backend serves Open Graph HTML,
 * then redirects browsers to the SPA CV page.
 */
export function getProfileCvShareUrl(userId) {
  return `${apiOrigin()}/share/cv/${userId}`;
}

export function getSiteShareUrl() {
  return `${apiOrigin()}/share`;
}

export function getProfileCvShareText(profile = {}) {
  const name = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.club || 'Profil';
  const role = profile.role ? String(profile.role) : '';
  const bits = [`CV · ${name}`];
  if (role) bits.push(role);
  if (profile.club && profile.club !== name) bits.push(profile.club);
  bits.push(APP_BRAND_NAME);
  return bits.join(' · ');
}

export function facebookShareHref(url) {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

export function whatsappShareHref(url, text) {
  return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`.trim())}`;
}

export function twitterShareHref(url, text) {
  return `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}
