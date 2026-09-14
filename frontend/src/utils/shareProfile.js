import { APP_BRAND_NAME } from '../config/branding';

export function getProfileCvShareUrl(userId, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  const base = String(origin || 'https://xtalenti.com').replace(/\/$/, '');
  return `${base}/cv/${userId}`;
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
