import React, { useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from '../theme/nativeComponents';
import { WebView } from 'react-native-webview';
import { youtubeEmbedUrl } from '../../utils/youtubeVideo';

export default function YouTubeWebPlayer({ videoId, height = 220, title = 'YouTube' }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const valid = /^[A-Za-z0-9_-]{11}$/.test(String(videoId || ''));

  if (!valid) {
    return (
      <View style={[styles.box, { height }]}>
        <Text style={styles.msg}>Video YouTube i pavlefshëm</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.box, { height }]}>
        <Text style={styles.msg}>Nuk u ngarkua videoja</Text>
        <TouchableOpacity onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${videoId}`)}>
          <Text style={styles.link}>Hap në YouTube</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const src = `${youtubeEmbedUrl(videoId)}?rel=0&modestbranding=1&playsinline=1`;

  return (
    <View style={[styles.wrap, { height }]}>
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color="#F59E0B" />
        </View>
      ) : null}
      <WebView
        source={{ uri: src }}
        style={styles.web}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction
        javaScriptEnabled
        domStorageEnabled
        accessibilityLabel={title}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
  web: { flex: 1, backgroundColor: '#000' },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    backgroundColor: '#0f172a',
  },
  box: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  msg: { color: '#94a3b8', fontSize: 13 },
  link: { color: '#F59E0B', marginTop: 8, fontWeight: '700' },
});
