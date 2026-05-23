import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

function transferIcon(type) {
  const icons = {
    player_transfer: '⚽',
    coach_appointment: '📋',
    staff_appointment: '👔',
    loan: '🔄',
  };
  return icons[type] || '📍';
}

export default function PublicProfileAboutTab({
  profile,
  transfers = [],
  theme,
  isOwner = false,
  onAddTransfer,
  onDeleteTransfer,
}) {
  const stats = profile?.stats && typeof profile.stats === 'object' ? profile.stats : {};
  const role = String(profile?.role || '').toLowerCase();
  const showTransfers = role === 'athlete' || role === 'coach' || role === 'trajner';

  return (
    <View style={styles.wrap}>
      {showTransfers ? (
        <View
          style={[
            styles.block,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View style={styles.transferHeader}>
            <Text style={[styles.blockTitle, { color: theme.text, marginBottom: 0 }]}>🔄 Transfer history</Text>
            {isOwner && onAddTransfer ? (
              <TouchableOpacity style={styles.addBtn} onPress={onAddTransfer}>
                <Text style={styles.addBtnText}>+ Add</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {transfers.length === 0 ? (
            <Text style={[styles.mutedCenter, { color: theme.muted }]}>No transfer history</Text>
          ) : (
            transfers.map((t) => (
              <View
                key={String(t.id)}
                style={[styles.transferRow, { borderColor: theme.border, backgroundColor: theme.chipBg }]}
              >
                <Text style={styles.transferIcon}>{transferIcon(t.transferType)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.transferClubs, { color: theme.text }]}>
                    {t.fromClub || 'Free agent'} → <Text style={{ color: '#2563eb' }}>{t.toClub || '—'}</Text>
                  </Text>
                  <Text style={[styles.transferMeta, { color: theme.muted }]}>
                    {[t.season, t.position, t.transferFee, t.contractUntil].filter(Boolean).join(' · ')}
                  </Text>
                  {t.notes ? (
                    <Text style={[styles.notes, { color: theme.muted }]}>{t.notes}</Text>
                  ) : null}
                </View>
                {isOwner && onDeleteTransfer ? (
                  <TouchableOpacity onPress={() => onDeleteTransfer(t)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="trash-outline" size={18} color="#dc2626" />
                  </TouchableOpacity>
                ) : null}
              </View>
            ))
          )}
        </View>
      ) : null}

      {profile?.bio ? (
        <View style={{ marginTop: showTransfers ? 16 : 0 }}>
          <Text style={[styles.blockTitle, { color: theme.text }]}>Bio</Text>
          <Text style={[styles.bio, { color: theme.muted }]}>{profile.bio}</Text>
        </View>
      ) : null}

      <View style={{ marginTop: 16 }}>
        <Text style={[styles.blockTitle, { color: theme.text }]}>Information</Text>
        <View style={styles.grid}>
          {profile?.city || profile?.country ? (
            <View style={styles.gridRow}>
              <Text style={styles.emoji}>📍</Text>
              <Text style={[styles.gridText, { color: theme.text }]}>
                {[profile.city, profile.country].filter(Boolean).join(', ')}
              </Text>
            </View>
          ) : null}
          {profile?.position ? (
            <View style={styles.gridRow}>
              <Text style={styles.emoji}>⚽</Text>
              <Text style={[styles.gridText, { color: theme.text }]}>{profile.position}</Text>
            </View>
          ) : null}
          {profile?.club ? (
            <View style={styles.gridRow}>
              <Text style={styles.emoji}>🏆</Text>
              <Text style={[styles.gridText, { color: theme.text }]}>{profile.club}</Text>
            </View>
          ) : null}
          {stats.preferredFoot ? (
            <View style={styles.gridRow}>
              <Text style={styles.emoji}>🦶</Text>
              <Text style={[styles.gridText, { color: theme.text }]}>Preferred foot: {stats.preferredFoot}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 8 },
  block: { borderRadius: 12, borderWidth: 1, padding: 14 },
  blockTitle: { fontSize: 17, fontWeight: '800', marginBottom: 10 },
  transferHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  addBtn: { backgroundColor: '#0f766e', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  mutedCenter: { textAlign: 'center', paddingVertical: 20, fontSize: 15 },
  transferRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  transferIcon: { fontSize: 26, marginRight: 10 },
  transferClubs: { fontSize: 15, fontWeight: '700' },
  transferMeta: { fontSize: 13, marginTop: 4 },
  notes: { fontSize: 13, marginTop: 6, lineHeight: 18 },
  bio: { fontSize: 15, lineHeight: 22 },
  grid: { marginTop: 4 },
  gridRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  emoji: { fontSize: 18, marginRight: 10, width: 28 },
  gridText: { flex: 1, fontSize: 15 },
});
