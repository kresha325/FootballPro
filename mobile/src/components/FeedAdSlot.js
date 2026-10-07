import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from '../theme/nativeComponents';
import { ResizeMode } from 'expo-av';
import { ManagedVideo, VideoPoster } from './media/LazyVideo';

/**
 * Shfaq një karusel reklamash.
 * Çdo ad ka displaySeconds (video = gjatësia; foto = 3s). Çmimi: €1 / 3s / ditë.
 */
export default function FeedAdSlot({ ads = [], isDark, isVisible = false }) {
  const safeAds = Array.isArray(ads) ? ads : [];
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!safeAds.length) {
      setActive(0);
      return;
    }
    setActive(Math.floor(Math.random() * safeAds.length));
  }, [ads]);

  useEffect(() => {
    if (safeAds.length <= 1) return undefined;
    const current = safeAds[active] || safeAds[0];
    const sec = Math.max(3, Number(current?.displaySeconds) || 3);
    const id = setTimeout(() => {
      setActive((prev) => (prev + 1) % safeAds.length);
    }, sec * 1000);
    return () => clearTimeout(id);
  }, [safeAds, active]);

  if (!safeAds.length) {
    return (
      <View style={[styles.wrap, isDark && styles.wrapDark]}>
        <Text style={[styles.empty, isDark && styles.emptyDark]}>Nuk ka reklama aktive.</Text>
      </View>
    );
  }

  const ad = safeAds[active] || safeAds[0];
  const accent = ad.color && /^#/.test(String(ad.color).trim()) ? String(ad.color).trim() : '#34d399';
  const videoUri = typeof ad.videoUrl === 'string' && ad.videoUrl.length > 0 ? ad.videoUrl : null;
  const imageUri = typeof ad.imageUrl === 'string' && ad.imageUrl.length > 0 ? ad.imageUrl : null;
  const displaySec = Math.max(3, Number(ad.displaySeconds) || 3);

  return (
    <View style={[styles.wrap, isDark && styles.wrapDark]}>
      <View style={styles.badgeRow}>
        <Text style={[styles.badge, isDark && styles.badgeDark]}>Reklamë</Text>
        <Text style={[styles.meta, isDark && styles.metaDark]}>{displaySec}s</Text>
      </View>
      <View style={[styles.cardInner, { borderColor: accent }]}>
        {videoUri && isVisible ? (
          <View style={[styles.mediaBox, isDark && styles.mediaBoxDark]}>
            <ManagedVideo
              source={{ uri: videoUri }}
              style={styles.video}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              isLooping
              isMuted
              useNativeControls={false}
            />
          </View>
        ) : videoUri ? (
          <View style={[styles.mediaBox, isDark && styles.mediaBoxDark]}>
            <VideoPoster posterUri={imageUri} style={styles.video} />
          </View>
        ) : imageUri ? (
          <View style={[styles.mediaBox, isDark && styles.mediaBoxDark]}>
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
          </View>
        ) : null}
        <View style={[styles.colorBar, { backgroundColor: accent }]} />
        <Text style={[styles.title, isDark && styles.titleDark]}>{ad.title || 'Ad'}</Text>
        <Text style={[styles.body, isDark && styles.bodyDark]}>{ad.text || ''}</Text>
        {safeAds.length > 1 ? (
          <View style={styles.dots}>
            {safeAds.map((_, i) => (
              <TouchableOpacity
                key={`dot-${i}`}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                onPress={() => setActive(i)}
                style={[
                  styles.dot,
                  i === active ? styles.dotActive : styles.dotIdle,
                  i > 0 ? { marginLeft: 8 } : null,
                ]}
                accessibilityLabel={`Reklama ${i + 1}`}
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 10,
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  wrapDark: {
    backgroundColor: '#0f172a',
    borderColor: '#1e293b',
  },
  badgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  badge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  badgeDark: { color: '#94a3b8' },
  meta: { fontSize: 11, fontWeight: '700', color: '#9A6B12' },
  metaDark: { color: '#F2C866' },
  empty: { textAlign: 'center', color: '#64748b', fontSize: 13, paddingVertical: 8 },
  emptyDark: { color: '#94a3b8' },
  cardInner: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  mediaBox: {
    height: 180,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaBoxDark: { backgroundColor: '#020617' },
  image: { width: '100%', height: '100%' },
  video: { width: '100%', height: '100%' },
  colorBar: { height: 4, width: '100%' },
  title: { fontSize: 17, fontWeight: '800', color: '#0f172a', paddingHorizontal: 12, paddingTop: 10 },
  titleDark: { color: '#f8fafc' },
  body: { fontSize: 14, color: '#334155', paddingHorizontal: 12, paddingBottom: 10, paddingTop: 4 },
  bodyDark: { color: '#cbd5e1' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingBottom: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: '#9A6B12' },
  dotIdle: { backgroundColor: '#cbd5e1' },
});
