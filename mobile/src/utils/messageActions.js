import * as FileSystem from 'expo-file-system';

export function replyPreviewText(message) {
  if (!message || message.deleted) return '';
  const text = typeof message.content === 'string' ? message.content.trim() : '';
  if (text) return text.length > 120 ? `${text.slice(0, 120)}…` : text;
  if (message.type === 'image') return '📷 Foto';
  if (message.type === 'video') return '🎬 Video';
  if (message.fileName) return message.fileName;
  if (message.fileUrl) return 'Media';
  return 'Mesazh';
}

export function resolveMessageFileUrl(message, mediaBaseUrl) {
  const raw = message?.fileUrl;
  if (!raw || typeof raw !== 'string') return null;
  if (/^https?:\/\//i.test(raw) || raw.startsWith('file:') || raw.startsWith('content:')) {
    return raw;
  }
  const base = String(mediaBaseUrl || '').replace(/\/$/, '');
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return `${base}${path}`;
}

export function messageHasMedia(message) {
  if (!message?.fileUrl) return false;
  if (message.type === 'image' || message.type === 'video' || message.type === 'file') {
    return true;
  }
  const hint = String(message.fileName || message.fileUrl || '');
  return /\.(jpe?g|png|gif|webp|heic|mp4|mov|avi|webm)$/i.test(hint);
}

function guessMime(message) {
  if (message.type === 'video') return 'video/mp4';
  if (message.type === 'image') return 'image/jpeg';
  const name = String(message.fileName || '').toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.mp4') || name.endsWith('.mov')) return 'video/mp4';
  return 'application/octet-stream';
}

/** Përgatit payload për POST /messages kur përcjellim mesazh (tekst + foto/video). */
export async function buildForwardSendOptions(message, mediaBaseUrl) {
  const content = typeof message.content === 'string' ? message.content.trim() : '';
  const uri = resolveMessageFileUrl(message, mediaBaseUrl);

  if (uri && messageHasMedia(message)) {
    const safeName = (message.fileName || `forward-${Date.now()}.jpg`).replace(/[^\w.\-]/g, '_');
    const mime = guessMime(message);

    if (uri.startsWith('file:') || uri.startsWith('content:')) {
      return {
        content,
        file: { uri, name: safeName, type: mime },
      };
    }

    if (/^https?:\/\//i.test(uri)) {
      try {
        const dest = `${FileSystem.cacheDirectory}${safeName}`;
        const downloaded = await FileSystem.downloadAsync(uri, dest);
        return {
          content,
          file: {
            uri: downloaded.uri,
            name: safeName,
            type: mime,
          },
        };
      } catch (_err) {
        const fallback = content || replyPreviewText(message);
        return { content: fallback ? `${fallback}\n${uri}` : uri };
      }
    }
  }

  return { content: content || replyPreviewText(message) || 'Mesazh i përcjellë' };
}
