import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function PublicProfileTabBar({ tabs, activeKey, onChange, theme }) {
  return (
    <View style={[styles.wrap, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {tabs.map((t) => {
          const active = t.key === activeKey;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, active && { borderBottomColor: theme.primary }]}
              onPress={() => onChange(t.key)}
            >
              <Ionicons name={tabIcon(t.key)} size={16} color={active ? theme.primary : theme.muted} />
              <Text style={[styles.tabText, { color: active ? theme.primaryText : theme.muted }]} numberOfLines={1}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function tabIcon(key) {
  const icons = {
    overview: 'grid-outline', posts: 'newspaper-outline', matches: 'football-outline',
    tournaments: 'trophy-outline', achievements: 'medal-outline', gallery: 'images-outline',
    videos: 'play-circle-outline', about: 'information-circle-outline', contact: 'chatbubble-outline',
    sponsors: 'people-outline',
  };
  return icons[key] || 'ellipse-outline';
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    overflow: 'hidden',
  },
  scroll: { paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center' },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontWeight: '700', fontSize: 14 },
});
