import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BACKEND_URL } from '../../config/constants';
import { messageHasMedia, replyPreviewText, resolveMessageFileUrl } from '../../utils/messageActions';

function mediaBaseUrl() {
  return String(BACKEND_URL || '').replace(/\/$/, '');
}

/**
 * Citat përgjigjeje me thumbnail për foto/video + tekst.
 * @param {{ message: object, mine?: boolean, compact?: boolean }} props
 */
export default function ReplyPreview({ message, mine = false, compact = false }) {
  if (!message) return null;

  const uri = resolveMessageFileUrl(message, mediaBaseUrl());
  const isVideo =
    message.type === 'video' ||
    /\.(mp4|mov|avi|webm)$/i.test(String(message.fileName || uri || ''));
  const isImage =
    message.type === 'image' ||
    (!isVideo && !!uri && /\.(jpe?g|png|gif|webp|heic)$/i.test(String(message.fileName || uri || '')));
  const isMediaFile = message.type === 'file';
  const hasMedia = messageHasMedia(message) && !!uri;
  const text = replyPreviewText(message);
  const showText = !!(message.content && String(message.content).trim());
  const senderName = message.sender
    ? `${message.sender.firstName || ''} ${message.sender.lastName || ''}`.trim() || 'User'
    : 'User';

  const nameStyle = [styles.name, mine && styles.nameMine, compact && styles.nameCompact];
  const textStyle = [styles.text, mine && styles.textMine, compact && styles.textCompact];

  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      {hasMedia ? (
        <View style={[styles.thumbWrap, compact && styles.thumbWrapCompact]}>
          {isImage || isMediaFile ? (
            <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
          ) : (
            <View style={styles.thumbVideo}>
              {uri ? (
                <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
              ) : null}
              <View style={styles.videoBadge}>
                <Ionicons name="videocam" size={compact ? 14 : 18} color="#fff" />
              </View>
            </View>
          )}
        </View>
      ) : null}
      <View style={styles.body}>
        <Text style={nameStyle} numberOfLines={1}>
          {senderName}
        </Text>
        {showText ? (
          <Text style={textStyle} numberOfLines={compact ? 2 : 3}>
            {text}
          </Text>
        ) : hasMedia ? (
          <Text style={textStyle}>{isVideo ? '🎬 Video' : '📷 Foto'}</Text>
        ) : (
          <Text style={textStyle} numberOfLines={2}>
            {text}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  rowCompact: { alignItems: 'flex-start' },
  thumbWrap: {
    width: 44,
    height: 44,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 8,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  thumbWrapCompact: { width: 40, height: 40 },
  thumb: { width: '100%', height: '100%' },
  thumbVideo: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  videoBadge: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: 11, fontWeight: '700', color: '#0f766e', marginBottom: 2 },
  nameMine: { color: '#e0f2f1' },
  nameCompact: { color: '#0f766e' },
  text: { fontSize: 12, color: '#64748b' },
  textMine: { color: 'rgba(255,255,255,0.85)' },
  textCompact: { fontSize: 13, color: '#475569' },
});
