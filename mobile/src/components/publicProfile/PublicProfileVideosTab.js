import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ResizeMode, Video } from 'expo-av';

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

export default function PublicProfileVideosTab({ videos = [], liveVideos = [], theme }) {
  const hasLive = Array.isArray(liveVideos) && liveVideos.length > 0;
  const hasUploads = Array.isArray(videos) && videos.length > 0;

  if (!hasLive && !hasUploads) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyEmoji}>🎬</Text>
        <Text style={[styles.emptyTitle, { color: theme.muted }]}>No videos yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
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
          {hasLive ? (
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Uploaded Videos</Text>
          ) : null}
          {videos.map((v) => (
            <View
              key={String(v.id)}
              style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <View style={styles.videoWrap}>
                <Video
                  source={{ uri: v.videoUrl }}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode={ResizeMode.CONTAIN}
                  useNativeControls
                  shouldPlay={false}
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
    </View>
  );
}

const styles = StyleSheet.create({
  emptyWrap: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 16 },
  list: {},
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '800', marginBottom: 10, marginTop: 4 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
  },
  badgeWrap: { position: 'absolute', top: 10, left: 10, zIndex: 2 },
  liveBadge: {
    backgroundColor: '#dc2626',
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  videoWrap: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  title: { fontWeight: '700', fontSize: 15, paddingHorizontal: 12, paddingTop: 10 },
  desc: { fontSize: 13, paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4 },
});
