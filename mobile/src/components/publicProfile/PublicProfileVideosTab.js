import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ResizeMode, Video } from 'expo-av';

export default function PublicProfileVideosTab({ videos = [], theme }) {
  if (!videos.length) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyEmoji}>🎬</Text>
        <Text style={[styles.emptyTitle, { color: theme.muted }]}>No videos yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
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
  );
}

const styles = StyleSheet.create({
  emptyWrap: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 16 },
  list: {},
  card: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
  },
  videoWrap: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  title: { fontWeight: '700', fontSize: 15, paddingHorizontal: 12, paddingTop: 10 },
  desc: { fontSize: 13, paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4 },
});
