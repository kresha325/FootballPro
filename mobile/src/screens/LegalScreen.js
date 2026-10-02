import React, { useEffect, useLayoutEffect, useMemo } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from '../theme/nativeComponents';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import {
  LEGAL_CONTACT,
  LEGAL_LAST_UPDATED,
  legalNav,
  legalPages,
} from '../content/legalPages';

export default function LegalScreen({ route, navigation }) {
  const kind = route.params?.kind || 'help';
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const page = legalPages[kind] || legalPages.help;

  const theme = useMemo(
    () => ({
      bg: isDark ? '#0f172a' : '#f8fafc',
      card: isDark ? '#1e293b' : '#ffffff',
      text: colors.text || (isDark ? '#f8fafc' : '#0f172a'),
      muted: colors.muted || (isDark ? '#94a3b8' : '#64748b'),
      border: isDark ? '#334155' : '#e2e8f0',
      gold: '#9A6B12',
      chipBg: isDark ? '#0f172a' : '#f1f5f9',
    }),
    [colors, isDark]
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: page?.title?.split('—')[0]?.trim() || 'Info & ligjore',
    });
  }, [navigation, page]);

  useEffect(() => {
    if (!legalPages[kind]) {
      navigation.setParams({ kind: 'help' });
    }
  }, [kind, navigation]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 28, paddingTop: 12 }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.navRow}
        style={{ flexGrow: 0, marginBottom: 8 }}
      >
        {legalNav.map((item) => {
          const active = item.kind === kind;
          return (
            <TouchableOpacity
              key={item.kind}
              onPress={() => navigation.setParams({ kind: item.kind })}
              style={[
                styles.navChip,
                {
                  backgroundColor: active ? 'rgba(154,107,18,0.18)' : theme.chipBg,
                  borderColor: active ? theme.gold : theme.border,
                },
              ]}
            >
              <Text style={{ color: active ? theme.gold : theme.text, fontWeight: '700', fontSize: 13 }}>
                {item.short}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={[styles.hero, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>{page.title}</Text>
        <Text style={[styles.meta, { color: theme.muted }]}>
          Përditësuar: {LEGAL_LAST_UPDATED} · {LEGAL_CONTACT.brand}
        </Text>
        {page.description ? (
          <Text style={[styles.desc, { color: theme.muted }]}>{page.description}</Text>
        ) : null}
      </View>

      {(page.sections || []).map((sec) => (
        <View
          key={sec.heading}
          style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <Text style={[styles.heading, { color: theme.gold }]}>{sec.heading}</Text>
          {(sec.paragraphs || []).map((p, i) => (
            <Text key={`${sec.heading}-${i}`} style={[styles.para, { color: theme.text }]}>
              {p}
            </Text>
          ))}
        </View>
      ))}

      <TouchableOpacity
        style={[styles.mailBtn, { backgroundColor: theme.gold }]}
        onPress={() => Linking.openURL(`mailto:${LEGAL_CONTACT.email}`)}
      >
        <Text style={styles.mailBtnText}>{LEGAL_CONTACT.email}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  navRow: { paddingHorizontal: 14, gap: 8, paddingBottom: 4 },
  navChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  hero: {
    marginHorizontal: 14,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  title: { fontSize: 22, fontWeight: '900', marginBottom: 6 },
  meta: { fontSize: 12, marginBottom: 8 },
  desc: { fontSize: 14, lineHeight: 20 },
  section: {
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  heading: { fontSize: 15, fontWeight: '800', marginBottom: 8 },
  para: { fontSize: 14, lineHeight: 21, marginBottom: 8 },
  mailBtn: {
    marginHorizontal: 14,
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  mailBtnText: { color: '#fff', fontWeight: '800' },
});
