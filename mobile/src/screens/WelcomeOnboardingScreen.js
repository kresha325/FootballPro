import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from '../theme/nativeComponents';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_BRAND_NAME } from '../config/branding';
import { useTheme } from '../context/ThemeContext';

export const WELCOME_ONBOARDING_KEY = 'welcome_onboarding_done';

const { width: PAGE_W } = Dimensions.get('window');
const IMAGE_W = Math.min(PAGE_W - 48, 360);
const IMAGE_H = Math.round(IMAGE_W * 0.75);

const SLIDES = [
  {
    key: 'discover',
    image: require('../../assets/onboarding/onboard-discover.png'),
    title: 'Zbulo talentin',
    body: 'Krijo profilin tënd, postimet dhe highlights — klube e skautë të shohin kush je.',
  },
  {
    key: 'connect',
    image: require('../../assets/onboarding/onboard-connect.png'),
    title: 'Lidhu me futbollin',
    body: 'Mesazhe, skautim, turne dhe live — gjithçka në një vend për lojtarë, klube dhe trajnerë.',
  },
  {
    key: 'grow',
    image: require('../../assets/onboarding/onboard-grow.png'),
    title: 'Rritu me X TALENTI',
    body: 'Ndërto karrierën, merr ftesa dhe qëndro i dukshëm për ata që kërkojnë talent.',
  },
];

export default function WelcomeOnboardingScreen({ onDone }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const listRef = useRef(null);
  const [index, setIndex] = useState(0);

  const finish = async () => {
    try {
      await AsyncStorage.setItem(WELCOME_ONBOARDING_KEY, '1');
    } catch (_e) {
      /* ignore */
    }
    onDone?.();
  };

  const goNext = () => {
    if (index >= SLIDES.length - 1) {
      finish();
      return;
    }
    const next = index + 1;
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
  };

  const brandRest = APP_BRAND_NAME.replace(/^x\s*/i, '').trim() || 'TALENTI';

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16, backgroundColor: colors.bg }]}>
      <View style={styles.topRow}>
        <Text style={styles.brand}>
          <Text style={[styles.brandX, { color: colors.primary }]}>X</Text>
          <Text style={[styles.brandRest, { color: colors.text }]}>{brandRest}</Text>
        </Text>
        <TouchableOpacity onPress={finish} hitSlop={12} accessibilityLabel="Anashkalo">
          <Text style={[styles.skip, { color: colors.muted }]}>Anashkalo</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / PAGE_W);
          setIndex(i);
        }}
        getItemLayout={(_, i) => ({ length: PAGE_W, offset: PAGE_W * i, index: i })}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width: PAGE_W }]}>
            <View style={[styles.imageWrap, { width: IMAGE_W, height: IMAGE_H, backgroundColor: colors.primarySoft }]}>
              <Image source={item.image} style={styles.image} resizeMode="cover" />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.body, { color: colors.muted }]}>{item.body}</Text>
          </View>
        )}
      />

      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <View
            key={s.key}
            style={[
              styles.dot,
              { backgroundColor: colors.borderStrong },
              i === index && [styles.dotActive, { backgroundColor: colors.primary }],
            ]}
          />
        ))}
      </View>

      <TouchableOpacity
        style={[styles.cta, { backgroundColor: colors.primary }]}
        onPress={goNext}
        activeOpacity={0.9}
      >
        <Text style={[styles.ctaText, { color: colors.onPrimary }]}>
          {index >= SLIDES.length - 1 ? 'Fillo' : 'Vazhdo'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  brand: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandX: {
    color: '#9A6B12',
  },
  brandRest: {
    color: '#0f172a',
  },
  skip: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  slide: {
    paddingHorizontal: 24,
    paddingTop: 20,
    alignItems: 'center',
  },
  imageWrap: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#ccfbf1',
    marginBottom: 24,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#475569',
    textAlign: 'center',
    maxWidth: 320,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#cbd5e1',
  },
  dotActive: {
    width: 22,
    backgroundColor: '#9A6B12',
  },
  cta: {
    marginHorizontal: 20,
    backgroundColor: '#9A6B12',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
