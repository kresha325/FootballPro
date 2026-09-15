import { APP_BRAND_NAME } from '../config/branding';

function webOrigin(origin) {
  return String(origin || (typeof window !== 'undefined' ? window.location.origin : 'https://xtalenti.com')).replace(
    /\/$/,
    ''
  );
}

/**
 * Host used in shared links (WhatsApp/Facebook show this domain).
 * Optional VITE_SHARE_ORIGIN = branded API host that serves /share/cv OG HTML
 * (e.g. https://share.xtalenti.com → Render). When unset, share the public SPA URL
 * so the preview domain is xtalenti.com — not footballpro.onrender.com.
 */
function shareOrigin(origin) {
  const env = import.meta.env?.VITE_SHARE_ORIGIN;
  if (env && typeof env === 'string' && env.trim()) {
    return String(env).replace(/\/$/, '');
  }
  return webOrigin(origin);
}

/** Public SPA page humans open. */
export function getProfileCvPublicUrl(userId, origin) {
  return `${webOrigin(origin)}/cv/${userId}`;
}

/**
 * URL pasted into WhatsApp / Facebook / etc.
 * Prefer branded xtalenti.com/cv/:id. If VITE_SHARE_ORIGIN is set to an OG host,
 * use /share/cv/:id on that host (backend serves meta, then redirects to SPA).
 */
export function getProfileCvShareUrl(userId, origin) {
  const base = shareOrigin(origin);
  const env = import.meta.env?.VITE_SHARE_ORIGIN;
  if (env && typeof env === 'string' && env.trim()) {
    return `${base}/share/cv/${userId}`;
  }
  return `${base}/cv/${userId}`;
}

export function getSiteShareUrl(origin) {
  const base = shareOrigin(origin);
  const env = import.meta.env?.VITE_SHARE_ORIGIN;
  if (env && typeof env === 'string' && env.trim()) {
    return `${base}/share`;
  }
  return `${base}/`;
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
