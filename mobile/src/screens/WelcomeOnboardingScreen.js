import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from '../theme/nativeComponents';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_BRAND_NAME } from '../config/branding';
import { useTheme } from '../context/ThemeContext';
import OptimizedImage from '../components/media/OptimizedImage';
import { LANGUAGES } from '../localization/catalog';
import { useLocale } from '../context/LocaleContext';

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
  const { language, languageSelected, setLanguage, t } = useLocale();
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

  const chooseLanguage = async (code) => {
    const alreadyCompleted = await AsyncStorage.getItem(WELCOME_ONBOARDING_KEY).catch(() => null);
    await setLanguage(code);
    if (alreadyCompleted === '1') {
      onDone?.();
    }
  };

  const brandRest = APP_BRAND_NAME.replace(/^x\s*/i, '').trim() || 'TALENTI';

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16, backgroundColor: colors.bg }]}>
      <View style={styles.topRow}>
        <Text style={styles.brand}>
          <Text style={[styles.brandX, { color: colors.primary }]}>X</Text>
          <Text style={[styles.brandRest, { color: colors.text }]}>{brandRest}</Text>
        </Text>
        {languageSelected ? (
          <TouchableOpacity onPress={finish} hitSlop={12} accessibilityLabel={t('skip')}>
            <Text style={[styles.skip, { color: colors.muted }]}>{t('skip')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {!languageSelected ? (
        <View style={styles.languagePage}>
          <Text style={[styles.languageTitle, { color: colors.text }]}>{t('chooseLanguage')}</Text>
          <Text style={[styles.languagePrompt, { color: colors.muted }]}>{t('languagePrompt')}</Text>
          <FlatList
            data={LANGUAGES}
            keyExtractor={(item) => item.code}
            contentContainerStyle={styles.languageList}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => chooseLanguage(item.code)}
                accessibilityRole="radio"
                accessibilityState={{ selected: language === item.code }}
                style={[styles.languageOption, { backgroundColor: colors.card, borderColor: language === item.code ? colors.primary : colors.border }]}
              >
                <Text style={[styles.languageOptionText, { color: colors.text }]}>{item.name}</Text>
                {language === item.code ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
              </TouchableOpacity>
            )}
          />
        </View>
      ) : (
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
              <OptimizedImage source={item.image} style={styles.image} contentFit="cover" />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{t(`${item.key}Title`)}</Text>
            <Text style={[styles.body, { color: colors.muted }]}>{t(`${item.key}Body`)}</Text>
          </View>
        )}
      />
      )}

      {languageSelected ? <View style={styles.dots}>
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
      </View> : null}

      {languageSelected ? <TouchableOpacity
        style={[styles.cta, { backgroundColor: colors.primary }]}
        onPress={goNext}
        activeOpacity={0.9}
      >
        <Text style={[styles.ctaText, { color: colors.onPrimary }]}>
          {index >= SLIDES.length - 1 ? t('start') : t('continue')}
        </Text>
      </TouchableOpacity> : null}
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
  languagePage: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  languageTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  languagePrompt: {
    fontSize: 15,
    marginBottom: 18,
  },
  languageList: {
    gap: 10,
    paddingBottom: 24,
  },
  languageOption: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  languageOptionText: {
    fontSize: 16,
    fontWeight: '600',
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
