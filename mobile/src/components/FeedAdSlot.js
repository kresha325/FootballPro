import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * Shfaq një karusel të shkurtër reklamash (si AdSlider në web).
 * `ads` duhet të jetë tashmë lista aktive nga API (e përzier opsionale nga prindi).
 */
export default function FeedAdSlot({ ads = [], isDark }) {
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
    const id = setInterval(() => {
      setActive((prev) => (prev + 1) % safeAds.length);
    }, 3000);
    return () => clearInterval(id);
  }, [safeAds]);

  if (!safeAds.length) {
    return (
      <View style={[styles.wrap, isDark && styles.wrapDark]}>
        <Text style={[styles.empty, isDark && styles.emptyDark]}>Nuk ka reklama aktive.</Text>
      </View>
    );
  }

  const ad = safeAds[active] || safeAds[0];
  const accent = ad.color && /^#/.test(String(ad.color).trim()) ? String(ad.color).trim() : '#34d399';
  const uri = typeof ad.imageUrl === 'string' && ad.imageUrl.length > 0 ? ad.imageUrl : null;

  return (
    <View style={[styles.wrap, isDark && styles.wrapDark]}>
      <Text style={[styles.badge, isDark && styles.badgeDark]}>Reklamë</Text>
      <View style={[styles.cardInner, { borderColor: accent }]}>
        {uri ? (
          <View style={[styles.imageBox, isDark && styles.imageBoxDark]}>
            <Image source={{ uri }} style={styles.image} resizeMode="contain" />
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
  badge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  badgeDark: { color: '#94a3b8' },
  empty: { textAlign: 'center', color: '#64748b', fontSize: 13, paddingVertical: 8 },
  emptyDark: { color: '#94a3b8' },
  cardInner: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  imageBox: {
    height: 160,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageBoxDark: { backgroundColor: '#020617' },
  image: { width: '100%', height: '100%' },
  colorBar: { height: 4, width: '100%' },
  title: { fontSize: 17, fontWeight: '800', color: '#0f172a', paddingHorizontal: 12, paddingTop: 10 },
  titleDark: { color: '#f8fafc' },
  body: { fontSize: 14, color: '#334155', paddingHorizontal: 12, paddingBottom: 10, paddingTop: 4 },
  bodyDark: { color: '#cbd5e1' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingBottom: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: '#0f766e' },
  dotIdle: { backgroundColor: '#cbd5e1' },
});
