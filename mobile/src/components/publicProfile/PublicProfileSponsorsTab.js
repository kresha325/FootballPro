import React from 'react';
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function PublicProfileSponsorsTab({ sponsors = [], theme }) {
  if (!sponsors.length) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: theme.muted }]}>You do not have any sponsors yet.</Text>
      </View>
    );
  }

  return (
    <View>
      {sponsors.map((s) => (
        <View
          key={String(s.id)}
          style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <View style={[styles.thumb, { backgroundColor: theme.chipBg }]}>
            {s.image ? (
              <Image source={{ uri: s.image }} style={styles.thumbImg} resizeMode="cover" />
            ) : (
              <Text style={{ fontSize: 28 }}>🎯</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: theme.text }]}>{s.name || 'Sponsor'}</Text>
            {s.link ? (
              <TouchableOpacity onPress={() => Linking.openURL(s.link).catch(() => {})}>
                <Text style={styles.link} numberOfLines={2}>
                  {s.link}
                </Text>
              </TouchableOpacity>
            ) : null}
            <Text style={[styles.dates, { color: theme.muted }]}>
              {s.startDate ? `Start: ${new Date(s.startDate).toLocaleDateString()}` : ''}
              {s.endDate ? ` · End: ${new Date(s.endDate).toLocaleDateString()}` : ''}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: 32, alignItems: 'center' },
  emptyText: { fontSize: 16, textAlign: 'center', paddingHorizontal: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    marginRight: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImg: { width: '100%', height: '100%' },
  name: { fontWeight: '800', fontSize: 16 },
  link: { color: '#2563eb', fontSize: 13, marginTop: 4, fontWeight: '600' },
  dates: { fontSize: 11, marginTop: 6 },
});
