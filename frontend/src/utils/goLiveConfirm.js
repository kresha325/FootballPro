import { normalizeYoutubeChannelId } from './youtubeChannel';

export function getProfileYoutubeChannelId(user) {
  const raw = user?.youtubeChannelId ?? user?.Profile?.youtubeChannelId ?? '';
  return normalizeYoutubeChannelId(raw);
}

export function confirmGoLiveInBrowser({ title, youtubeChannelId }) {
  const yt = youtubeChannelId
    ? `YouTube (automatik nga profili): ${youtubeChannelId}`
    : 'YouTube: nuk është vendosur — përdoret LiveKit ose vendos UC… te Settings.';
  return window.confirm(
    `Konfirmo Go Live?\n\nTitulli: ${title || 'Live'}\n${yt}\n\nID e kanalit lidhet automatikisht me stream-in.`
  );
}
