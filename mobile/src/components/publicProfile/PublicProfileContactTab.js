import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function PublicProfileContactTab({ profile, theme }) {
  const contact = profile?.contact && typeof profile.contact === 'object' ? profile.contact : {};
  const email = profile?.User?.email || profile?.email;
  const phone = contact.phone;
  const ig = contact.instagram;
  const tw = contact.twitter;
  const fb = contact.facebook;

  const openUrl = (url) => Linking.openURL(url).catch(() => {});

  const rows = [];
  if (email) {
    rows.push(
      <View key="email" style={styles.row}>
        <Text style={styles.icon}>📧</Text>
        <Text style={[styles.text, { color: theme.text }]} selectable>
          {email}
        </Text>
      </View>
    );
  }
  if (phone) {
    rows.push(
      <View key="phone" style={styles.row}>
        <Text style={styles.icon}>📱</Text>
        <Text style={[styles.text, { color: theme.text }]} selectable>
          {phone}
        </Text>
      </View>
    );
  }
  if (ig) {
    const h = String(ig).replace(/^@/, '');
    rows.push(
      <TouchableOpacity
        key="ig"
        style={styles.row}
        onPress={() => openUrl(`https://instagram.com/${encodeURIComponent(h)}`)}
      >
        <Text style={styles.icon}>📷</Text>
        <Text style={[styles.link, { color: '#2563eb' }]}>{ig}</Text>
      </TouchableOpacity>
    );
  }
  if (tw) {
    const h = String(tw).replace(/^@/, '');
    rows.push(
      <TouchableOpacity
        key="tw"
        style={styles.row}
        onPress={() => openUrl(`https://twitter.com/${encodeURIComponent(h)}`)}
      >
        <Text style={styles.icon}>🐦</Text>
        <Text style={[styles.link, { color: '#2563eb' }]}>{tw}</Text>
      </TouchableOpacity>
    );
  }
  if (fb) {
    const url = String(fb).startsWith('http') ? fb : `https://facebook.com/${String(fb).replace(/^\//, '')}`;
    rows.push(
      <TouchableOpacity key="fb" style={styles.row} onPress={() => openUrl(url)}>
        <Text style={styles.icon}>👤</Text>
        <Text style={[styles.link, { color: '#2563eb' }]}>Facebook profile</Text>
      </TouchableOpacity>
    );
  }

  if (!rows.length) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: theme.muted }]}>No contact information available</Text>
      </View>
    );
  }

  return <View style={styles.wrap}>{rows}</View>;
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  icon: { fontSize: 22, marginRight: 12, width: 36 },
  text: { flex: 1, fontSize: 16 },
  link: { flex: 1, fontSize: 16, fontWeight: '600' },
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 16 },
});
