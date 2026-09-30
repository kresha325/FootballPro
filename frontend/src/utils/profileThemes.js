/** Pro profile accent themes — keep in sync with backend/utils/profileThemes.js */

export const PROFILE_THEMES = [
  { id: 'default', label: 'Standarde', accent: '#9A6B12', soft: 'rgba(154,107,18,0.14)' },
  { id: 'gold', label: 'Gold', accent: '#D4A017', soft: 'rgba(212,160,23,0.16)' },
  { id: 'midnight', label: 'Midnight', accent: '#5B7CFA', soft: 'rgba(91,124,250,0.16)' },
  { id: 'forest', label: 'Forest', accent: '#2F9E6A', soft: 'rgba(47,158,106,0.16)' },
  { id: 'crimson', label: 'Crimson', accent: '#C44536', soft: 'rgba(196,69,54,0.16)' },
  { id: 'ocean', label: 'Ocean', accent: '#0E8A9A', soft: 'rgba(14,138,154,0.16)' },
];

export function resolveProfileTheme(id) {
  const key = String(id || 'default').toLowerCase();
  return PROFILE_THEMES.find((t) => t.id === key) || PROFILE_THEMES[0];
}

export const EARLY_ACCESS_LABS_KEY = 'xt_early_access_labs';

export const EARLY_ACCESS_FEATURES = [
  {
    id: 'ai_tools',
    label: 'Mjete AI (bio, caption, raport skauti)',
    description: 'Shfaq butonat AI kur serveri ka OPENAI_API_KEY.',
  },
  {
    id: 'dense_feed',
    label: 'Feed i ngjeshur (eksperimental)',
    description: 'Më pak hapësirë midis postimeve në feed.',
  },
];

export function loadEarlyAccessPrefs() {
  try {
    const raw = localStorage.getItem(EARLY_ACCESS_LABS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveEarlyAccessPrefs(prefs) {
  localStorage.setItem(EARLY_ACCESS_LABS_KEY, JSON.stringify(prefs || {}));
  window.dispatchEvent(new CustomEvent('xt-early-access-changed', { detail: prefs }));
}

export function isEarlyAccessEnabled(featureId) {
  const prefs = loadEarlyAccessPrefs();
  return Boolean(prefs?.[featureId]);
}

export function prioritySupportMailto({ userId, name, email } = {}) {
  const subject = encodeURIComponent('[Pro Priority] Kërkesë mbështetjeje');
  const body = encodeURIComponent(
    [
      'Përshëndetje X TALENTI Support,',
      '',
      'Kam planin Pro dhe kërkoj mbështetje prioritare.',
      '',
      `User ID: ${userId || '—'}`,
      `Emri: ${name || '—'}`,
      `Email: ${email || '—'}`,
      '',
      'Problemi / pyetja:',
      '',
    ].join('\n')
  );
  return `mailto:support@xtalenti.com?subject=${subject}&body=${body}`;
}
