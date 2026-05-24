import { Alert } from 'react-native';
import { normalizeYoutubeChannelId } from './youtubeChannel';

export function getProfileYoutubeChannelId(user, profileData) {
  const raw =
    profileData?.youtubeChannelId ??
    user?.Profile?.youtubeChannelId ??
    user?.profile?.youtubeChannelId ??
    user?.youtubeChannelId ??
    '';
  return normalizeYoutubeChannelId(raw);
}

/**
 * Dialog konfirmimi para Go Live — tregon YouTube ID nga profili (merret automatikisht nga serveri).
 */
export function confirmGoLiveAlert({ title, description, youtubeChannelId, onConfirm, onOpenSettings }) {
  const yt = youtubeChannelId
    ? `Kanali YouTube (automatik):\n${youtubeChannelId}\n\nShikuesit shohin live-in e këtij kanali në YouTube.`
    : 'YouTube: nuk ke vendosur Channel ID te Settings.\n\nDo përdoret LiveKit (kamera) ose udhëzime YouTube.';

  const buttons = [{ text: 'Anulo', style: 'cancel' }];
  if (!youtubeChannelId && onOpenSettings) {
    buttons.push({ text: 'Settings', onPress: onOpenSettings });
  }
  buttons.push({ text: 'Nis LIVE', style: 'destructive', onPress: onConfirm });

  Alert.alert(
    'Konfirmo transmetimin live',
    `Titulli: ${title || 'Live'}\n${description ? `\n${description}\n\n` : '\n'}${yt}`,
    buttons
  );
}
