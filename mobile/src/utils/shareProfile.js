import { Alert, Linking, Share } from 'react-native';
import { WEB_APP_URL, SHARE_ORIGIN, publicAssetBaseUrl, BACKEND_URL } from '../config/constants';

function webOrigin() {
  return (WEB_APP_URL || 'https://xtalenti.com').replace(/\/$/, '');
}

function apiOrigin() {
  try {
    return publicAssetBaseUrl();
  } catch {
    return String(BACKEND_URL || 'https://footballpro.onrender.com')
      .replace(/\/api\/?$/, '')
      .replace(/\/$/, '');
  }
}

/** OG host: SHARE_ORIGIN (e.g. share.xtalenti.com) or API — SPA /cv has no personal meta. */
function ogShareOrigin() {
  const custom = SHARE_ORIGIN && String(SHARE_ORIGIN).trim();
  if (custom) return custom.replace(/\/$/, '');
  return apiOrigin();
}

/** SPA page for humans */
export function getProfileCvPublicUrl(userId) {
  return `${webOrigin()}/cv/${userId}`;
}

/** URL for WhatsApp / Facebook — backend /share/cv serves name + photo OG. */
export function getProfileCvShareUrl(userId) {
  return `${ogShareOrigin()}/share/cv/${userId}`;
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

async function copyLink(url, tip) {
  try {
    await Share.share({ message: url, url, title: 'X TALENTI' });
  } catch {
    Alert.alert('Linku', url);
  }
  if (tip) Alert.alert('Gati', tip);
}

export async function previewProfileCv(profile) {
  const url = getProfileCvPublicUrl(profile.id || profile.userId);
  await openShareUrl(url, 'CV');
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

export async function shareProfileCvCopy(profile) {
  const url = getProfileCvShareUrl(profile.id || profile.userId);
  await copyLink(url, 'Linku i CV u kopjua / u nda.');
}

function showSharePlatforms(profile) {
  Alert.alert('Ndaj CV', 'Zgjidh platformën', [
    { text: 'WhatsApp', onPress: () => shareProfileCvWhatsApp(profile) },
    { text: 'Facebook', onPress: () => shareProfileCvFacebook(profile) },
    { text: 'Kopjo linkun', onPress: () => shareProfileCvCopy(profile) },
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
