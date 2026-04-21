import React, { useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { BACKEND_URL } from '../config/constants';

function sponsorImageUri(s) {
  const raw = s?.imagePreview || s?.image;
  if (!raw || typeof raw !== 'string') return null;
  if (raw.startsWith('http')) return raw;
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return `${BACKEND_URL}${path}`;
}

function openSponsorLink(sponsor) {
  const url = sponsor?.link;
  if (!url || typeof url !== 'string' || url === '#') return;
  const normalized = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
  Linking.openURL(normalized).catch(() => {});
}

/**
 * Shirit kompakt sponsorësh për post (si web SponsorBanner compact).
 */
export default function PostSponsorStrip({ sponsors, isDark, variant = 'inline' }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const intervalRef = useRef(null);

  const list = Array.isArray(sponsors) ? sponsors.filter(Boolean) : [];

  useEffect(() => {
    if (list.length > 1) {
      intervalRef.current = setInterval(() => {
        setActiveIdx((idx) => (idx + 1) % list.length);
      }, 3000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
    setActiveIdx(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
    return undefined;
  }, [list.length]);

  if (!list.length) return null;

  const sponsor = list[activeIdx];
  const uri = sponsorImageUri(sponsor);
  const isOverlay = variant === 'overlay';

  return (
    <Pressable
      onPress={() => openSponsorLink(sponsor)}
      style={[
        styles.strip,
        isDark && styles.stripDark,
        isOverlay && styles.stripOverlay,
      ]}
      accessibilityRole="link"
      accessibilityLabel={`Sponsor: ${sponsor?.name || ''}`}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumbFallback, isDark && styles.thumbFallbackDark]}>
          <Text style={styles.thumbEmoji}>🎯</Text>
        </View>
      )}
      <Text style={[styles.name, isDark && styles.nameDark]} numberOfLines={2}>
        {sponsor?.name || 'Sponsor'}
      </Text>
    </Pressable>
  );
}

export function SponsoredLabel({ isDark }) {
  return (
    <View style={styles.labelRow}>
      <Text style={[styles.label, isDark && styles.labelDark]}>Sponsored</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#b45309',
    letterSpacing: 0.5,
  },
  labelDark: {
    color: '#fbbf24',
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#facc15',
    backgroundColor: '#fef9c3',
  },
  stripDark: {
    backgroundColor: 'rgba(66,32,6,0.55)',
    borderColor: '#eab308',
  },
  stripOverlay: {
    backgroundColor: 'rgba(254,243,199,0.92)',
  },
  thumb: {
    width: 36,
    height: 28,
    borderRadius: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#eab308',
    backgroundColor: '#e2e8f0',
  },
  thumbFallback: {
    width: 36,
    height: 28,
    borderRadius: 6,
    marginRight: 8,
    backgroundColor: '#fde68a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbFallbackDark: {
    backgroundColor: '#713f12',
  },
  thumbEmoji: {
    fontSize: 16,
  },
  name: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
    color: '#1c1917',
    maxWidth: 160,
  },
  nameDark: {
    color: '#fef3c7',
  },
});
