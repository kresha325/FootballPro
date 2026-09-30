import AsyncStorage from '@react-native-async-storage/async-storage';

export const PROFILE_THEMES = [
  { id: 'default', label: 'Standarde', accent: '#9A6B12' },
  { id: 'gold', label: 'Gold', accent: '#D4A017' },
  { id: 'midnight', label: 'Midnight', accent: '#5B7CFA' },
  { id: 'forest', label: 'Forest', accent: '#2F9E6A' },
  { id: 'crimson', label: 'Crimson', accent: '#C44536' },
  { id: 'ocean', label: 'Ocean', accent: '#0E8A9A' },
];

export const EARLY_ACCESS_LABS_KEY = 'xt_early_access_labs';

export const EARLY_ACCESS_FEATURES = [
  {
    id: 'ai_tools',
    label: 'Mjete AI',
    description: 'Bio / caption / raport skauti (kur AI është aktiv në server)',
  },
  {
    id: 'dense_feed',
    label: 'Feed i ngjeshur',
    description: 'Më pak hapësirë midis postimeve (web)',
  },
];

export async function loadEarlyAccessPrefs() {
  try {
    const raw = await AsyncStorage.getItem(EARLY_ACCESS_LABS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveEarlyAccessPrefs(prefs) {
  await AsyncStorage.setItem(EARLY_ACCESS_LABS_KEY, JSON.stringify(prefs || {}));
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
