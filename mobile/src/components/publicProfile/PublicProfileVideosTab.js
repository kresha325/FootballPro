import React, { useState } from 'react';
import {
  Image,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from '../../theme/nativeComponents';
import { ResizeMode, Video } from 'expo-av';
import { youtubeThumbnailUrl } from '../../utils/youtubeVideo';
import YouTubeWebPlayer from '../media/YouTubeWebPlayer';
import AddMediaSheet from '../media/AddMediaSheet';
import { mediaEventRequest } from '../../api/client';
import { absoluteBackendUrl } from '../../config/constants';

const HIGHLIGHT_CATEGORIES = new Set(['match_highlight', 'goal', 'assist', 'save', 'skills', 'tackle']);

function LiveVideoCard({ item, theme }) {
  const uri = item?.url;
  if (!uri) return null;
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.badgeWrap}>
        <Text style={styles.liveBadge}>LIVE</Text>
      </View>
      <View style={styles.videoWrap}>
        <Video
          source={{ uri }}
          style={StyleSheet.absoluteFillObject}
          resizeMode={ResizeMode.CONTAIN}
          useNativeControls
          shouldPlay={false}
        />
      </View>
      {item.title ? (
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
          {item.title}
        </Text>
      ) : null}
    </View>
  );
}

function YoutubeCard({ item, theme, onOpen }) {
  const thumb = item.thumbnailUrl || youtubeThumbnailUrl(item.youtubeVideoId);
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={() => onOpen(item)}
      activeOpacity={0.85}
    >
      <View style={styles.videoWrap}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0f172a' }]} />
        )}
        <View style={styles.playOverlay}>
          <Text style={styles.playIcon}>▶</Text>
        </View>
        <View style={styles.badgeWrap}>
          <Text style={styles.ytBadge}>YouTube</Text>
        </View>
      </View>
      <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={[styles.desc, { color: theme.muted }]}>{item.category}</Text>
    </TouchableOpacity>
  );
}

export default function PublicProfileVideosTab({
  videos = [],
  liveVideos = [],
  youtubeMedia = [],
  theme,
  canManage = false,
  mediaDefaults = {},
  onMediaSaved,
}) {
  const [watching, setWatching] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [highlightsOnly, setHighlightsOnly] = useState(false);
  const hasLive = Array.isArray(liveVideos) && liveVideos.length > 0;
  const hasUploads = Array.isArray(videos) && videos.length > 0;
  const hasYt = Array.isArray(youtubeMedia) && youtubeMedia.length > 0;

  const openYt = (item) => {
    mediaEventRequest(item.id, 'profile_click').catch(() => {});
    setWatching(item);
  };

  if (!hasLive && !hasUploads && !hasYt && !canManage) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyEmoji}>🎬</Text>
        <Text style={[styles.emptyTitle, { color: theme.muted }]}>No videos yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {canManage ? (
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtnText}>+ Shto video YouTube</Text>
        </TouchableOpacity>
      ) : null}

      {hasYt ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>YouTube</Text>
          <TouchableOpacity onPress={() => setHighlightsOnly((value) => !value)}>
            <Text style={[styles.sectionTitle, { color: theme.muted }]}>
              {highlightsOnly ? 'Show all videos' : 'Highlights only'}
            </Text>
          </TouchableOpacity>
          {youtubeMedia
            .filter((item) => !highlightsOnly || HIGHLIGHT_CATEGORIES.has(item.category) || item.featured)
            .map((v) => (
            <YoutubeCard key={`yt-${v.id}`} item={v} theme={theme} onOpen={openYt} />
          ))}
        </View>
      ) : canManage ? (
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyTitle, { color: theme.muted }]}>
            Nuk ka video YouTube ende. Ngarko në YouTube dhe shto linkun.
          </Text>
        </View>
      ) : null}

      {hasLive ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Live Videos</Text>
          {liveVideos.map((v, idx) => (
            <LiveVideoCard key={v.streamId ? `live-${v.streamId}` : `live-${idx}`} item={v} theme={theme} />
          ))}
        </View>
      ) : null}

      {hasUploads ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Uploaded Videos</Text>
          {videos.map((v) => (
            <View
              key={String(v.id)}
              style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <View style={styles.videoWrap}>
                <Video
                  source={{ uri: absoluteBackendUrl(v.videoUrl) || v.videoUrl }}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode={ResizeMode.CONTAIN}
                  useNativeControls
                  shouldPlay={false}
                  isMuted={false}
                  volume={1}
                />
              </View>
              {v.title ? (
                <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
                  {v.title}
                </Text>
              ) : null}
              {v.description ? (
                <Text style={[styles.desc, { color: theme.muted }]} numberOfLines={3}>
                  {v.description}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <Modal visible={!!watching} animationType="slide" onRequestClose={() => setWatching(null)}>
        <View style={styles.watchWrap}>
          <View style={styles.watchHeader}>
            <Text style={styles.watchTitle} numberOfLines={2}>
              {watching?.title || 'Video'}
            </Text>
            <TouchableOpacity onPress={() => setWatching(null)}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>
          {watching?.youtubeVideoId ? (
            <YouTubeWebPlayer videoId={watching.youtubeVideoId} height={240} title={watching.title} />
          ) : null}
          <TouchableOpacity
            style={styles.openYt}
            onPress={() => watching?.youtubeUrl && Linking.openURL(watching.youtubeUrl)}
          >
            <Text style={styles.openYtText}>Hap në YouTube</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <AddMediaSheet
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        defaults={mediaDefaults}
        onSaved={(item) => onMediaSaved?.(item)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  emptyWrap: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 16 },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 15, textAlign: 'center', lineHeight: 21 },
  list: {},
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '800', marginBottom: 10, marginTop: 4 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  videoWrap: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  title: { fontSize: 15, fontWeight: '700', paddingHorizontal: 12, paddingTop: 10 },
  desc: { fontSize: 13, paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4 },
  badgeWrap: { position: 'absolute', top: 8, left: 8 },
  liveBadge: {
    backgroundColor: '#dc2626',
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
  },
  ytBadge: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    textAlign: 'center',
    lineHeight: 48,
    backgroundColor: '#dc2626',
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  addBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 14,
  },
  addBtnText: { fontWeight: '800', color: '#0f172a' },
  watchWrap: { flex: 1, backgroundColor: '#0f172a', paddingTop: 54, paddingHorizontal: 12 },
  watchHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  watchTitle: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '800', marginRight: 8 },
  close: { color: '#94a3b8', fontSize: 22, padding: 4 },
  openYt: { marginTop: 16, alignItems: 'center' },
  openYtText: { color: '#F59E0B', fontWeight: '700' },
});
