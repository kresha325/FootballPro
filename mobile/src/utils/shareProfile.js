import { Alert, Linking, Share } from 'react-native';
import { WEB_APP_URL } from '../config/constants';

export function getProfileCvShareUrl(userId) {
  const base = (WEB_APP_URL || 'https://xtalenti.com').replace(/\/$/, '');
  return `${base}/cv/${userId}`;
}

export function getProfileCvShareText(profile) {
  const name =
    `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() ||
    profile?.club ||
    'Profil';
  const role = profile?.role ? String(profile.role) : '';
  const bits = [`CV · ${name}`];
  if (role) bits.push(role);
  if (profile?.club && profile.club !== name) bits.push(profile.club);
  bits.push('X TALENTI');
  return bits.join(' · ');
}

async function openShareUrl(url, failLabel) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Nuk u hap', `${failLabel} nuk është i disponueshëm në këtë pajisje.`);
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert('Gabim', `Nuk u hap ${failLabel}.`);
  }
}

export async function previewProfileCv(profile) {
  const url = getProfileCvShareUrl(profile.id || profile.userId);
  await openShareUrl(url, 'CV');
}

export async function shareProfileCvNative(profile) {
  const url = getProfileCvShareUrl(profile.id || profile.userId);
  const text = getProfileCvShareText(profile);
  await Share.share({
    message: `${text}\n${url}`,
    url,
    title: 'X TALENTI CV',
  });
}

export async function shareProfileCvWhatsApp(profile) {
  const url = getProfileCvShareUrl(profile.id || profile.userId);
  const text = getProfileCvShareText(profile);
  await openShareUrl(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, 'WhatsApp');
}

export async function shareProfileCvFacebook(profile) {
  const url = getProfileCvShareUrl(profile.id || profile.userId);
  await openShareUrl(
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    'Facebook'
  );
}

export async function shareProfileCvTwitter(profile) {
  const url = getProfileCvShareUrl(profile.id || profile.userId);
  const text = getProfileCvShareText(profile);
  await openShareUrl(
    `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    'X (Twitter)'
  );
}

function showSharePlatforms(profile) {
  Alert.alert('Ndaj CV', 'Zgjidh platformën', [
    { text: 'WhatsApp', onPress: () => shareProfileCvWhatsApp(profile) },
    { text: 'Facebook', onPress: () => shareProfileCvFacebook(profile) },
    { text: 'X (Twitter)', onPress: () => shareProfileCvTwitter(profile) },
    { text: 'Më shumë…', onPress: () => shareProfileCvNative(profile) },
    { text: 'Anulo', style: 'cancel' },
  ]);
}

/** Owner flow: preview CV first, then optionally share. */
export function promptShareProfileCv(profile) {
  if (!profile?.id && !profile?.userId) return;
  Alert.alert('CV dixhitale', 'Shiko CV-në para se ta ndash.', [
    { text: 'Shiko CV', onPress: () => previewProfileCv(profile) },
    { text: 'Ndaj…', onPress: () => showSharePlatforms(profile) },
    { text: 'Anulo', style: 'cancel' },
  ]);
}
