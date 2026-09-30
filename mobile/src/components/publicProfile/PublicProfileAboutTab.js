import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from '../../theme/nativeComponents';
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

function isCurrentClubStint(transfer) {
  return (
    transfer?.notes === '__current_club__' ||
    String(transfer?.contractUntil || '').toLowerCase() === 'vazhdon'
  );
}

function statusLabel(transfer) {
  const status = String(transfer?.status || 'confirmed').toLowerCase();
  if (status === 'pending') {
    const fromOk = !transfer.fromClubUserId || transfer.fromClubConfirmedAt;
    const toOk = Boolean(transfer.toClubConfirmedAt);
    return `Në pritje (${fromOk ? '✓' : '…'} nisës · ${toOk ? '✓' : '…'} destinacion)`;
  }
  if (status === 'rejected') return 'Refuzuar';
  return 'I konfirmuar';
}

function statusColor(transfer) {
  const status = String(transfer?.status || 'confirmed').toLowerCase();
  if (status === 'pending') return '#b45309';
  if (status === 'rejected') return '#dc2626';
  return '#059669';
}

function athleteName(transfer) {
  const u = transfer?.User || transfer?.user;
  if (!u) return `Atleti #${transfer?.userId || ''}`;
  return `${u.firstName || ''} ${u.lastName || ''}`.trim() || `Atleti #${transfer.userId}`;
}

export default function PublicProfileAboutTab({
  profile,
  transfers = [],
  clubPending = [],
  theme,
  isOwner = false,
  isClubViewer = false,
  myClubId = null,
  actionTransferId = null,
  onAddTransfer,
  onDeleteTransfer,
  onConfirmTransfer,
  onRejectTransfer,
  onPressClub,
  onPressAthlete,
}) {
  const stats = profile?.stats && typeof profile.stats === 'object' ? profile.stats : {};
  const role = String(profile?.role || '').toLowerCase();
  const showTransfers = role === 'athlete' || role === 'coach' || role === 'trajner' || role === 'club';

  const canAct = (t) => {
    if (!isClubViewer || myClubId == null || String(t?.status) !== 'pending') return false;
    return Number(t.fromClubUserId) === myClubId || Number(t.toClubUserId) === myClubId;
  };

  const mySideConfirmed = (t) => {
    if (Number(t.fromClubUserId) === myClubId) return Boolean(t.fromClubConfirmedAt);
    if (Number(t.toClubUserId) === myClubId) return Boolean(t.toClubConfirmedAt);
    return false;
  };

  const renderClubActions = (t) => {
    if (!canAct(t)) return null;
    if (mySideConfirmed(t)) {
      return <Text style={styles.confirmedHint}>Klubi yt e konfirmoi</Text>;
    }
    const busy = actionTransferId === t.id;
    return (
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.confirmBtn, busy && styles.btnDisabled]}
          disabled={busy}
          onPress={() => onConfirmTransfer?.(t)}
        >
          <Text style={styles.confirmBtnText}>Konfirmo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.rejectBtn, busy && styles.btnDisabled]}
          disabled={busy}
          onPress={() => onRejectTransfer?.(t)}
        >
          <Text style={styles.rejectBtnText}>Refuzo</Text>
        </TouchableOpacity>
      </View>
    );
  };

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
            {isOwner && role !== 'club' && onAddTransfer ? (
              <TouchableOpacity style={styles.addBtn} onPress={onAddTransfer}>
                <Text style={styles.addBtnText}>+ Add</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <Text style={[styles.dualNote, { color: theme.muted }]}>
            Transferet e reja kërkojnë konfirmim nga të dy klubet. Klubi aktual ndryshon vetëm pasi të dyja palët konfirmojnë.
          </Text>

          {isClubViewer && clubPending.length > 0 ? (
            <View style={styles.pendingBox}>
              <Text style={styles.pendingTitle}>
                Transfere në pritje për klubin tënd ({clubPending.length})
              </Text>
              {clubPending.map((t) => (
                <View key={`pending-${t.id}`} style={[styles.transferRow, styles.pendingRow]}>
                  <View style={{ flex: 1 }}>
                    <TouchableOpacity
                      disabled={!t.userId || !onPressAthlete}
                      onPress={() => t.userId && onPressAthlete?.(t.userId)}
                    >
                      <Text style={[styles.transferClubs, { color: '#2563eb' }]}>{athleteName(t)}</Text>
                    </TouchableOpacity>
                    <Text style={[styles.transferMeta, { color: theme.muted }]}>
                      {t.fromClub || 'Free agent'} → {t.toClub} · {t.season}
                    </Text>
                    {renderClubActions(t)}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {role === 'club' && transfers.length === 0 && clubPending.length === 0 ? (
            <Text style={[styles.mutedCenter, { color: theme.muted }]}>Nuk ka transfere në pritje</Text>
          ) : null}

          {role !== 'club' && transfers.length === 0 ? (
            <Text style={[styles.mutedCenter, { color: theme.muted }]}>No transfer history</Text>
          ) : null}

          {role !== 'club'
            ? transfers.map((t) => {
                const current = isCurrentClubStint(t);
                return (
                  <View
                    key={String(t.id)}
                    style={[styles.transferRow, { borderColor: theme.border, backgroundColor: theme.chipBg }]}
                  >
                    <Text style={styles.transferIcon}>{transferIcon(t.transferType)}</Text>
                    <View style={{ flex: 1 }}>
                      {current ? (
                        <>
                          <Text style={[styles.transferClubs, { color: theme.text }]}>
                            <Text style={{ color: '#2563eb' }}>{t.toClub || '—'}</Text>
                            {'  '}
                            <Text style={styles.currentBadge}>Klubi aktual</Text>
                          </Text>
                          <Text style={[styles.transferMeta, { color: theme.muted }]}>
                            {[t.season, 'vazhdon', t.position].filter(Boolean).join(' · ')}
                          </Text>
                        </>
                      ) : (
                        <>
                          <Text style={[styles.transferClubs, { color: theme.text }]}>
                            {t.fromClub || 'Free agent'} → <Text style={{ color: '#2563eb' }}>{t.toClub || '—'}</Text>
                          </Text>
                          <Text style={[styles.statusBadge, { color: statusColor(t) }]}>{statusLabel(t)}</Text>
                          <Text style={[styles.transferMeta, { color: theme.muted }]}>
                            {[t.season, t.position, t.transferFee, t.contractUntil].filter(Boolean).join(' · ')}
                          </Text>
                          {t.notes && t.notes !== '__current_club__' ? (
                            <Text style={[styles.notes, { color: theme.muted }]}>{t.notes}</Text>
                          ) : null}
                          {renderClubActions(t)}
                        </>
                      )}
                    </View>
                    {isOwner && onDeleteTransfer ? (
                      <TouchableOpacity onPress={() => onDeleteTransfer(t)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="trash-outline" size={18} color="#dc2626" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })
            : null}
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
            <TouchableOpacity
              style={styles.gridRow}
              disabled={!profile.clubId || !onPressClub}
              onPress={() => profile.clubId && onPressClub?.(profile.clubId)}
              activeOpacity={0.7}
            >
              <Text style={styles.emoji}>🏆</Text>
              <Text
                style={[
                  styles.gridText,
                  { color: profile.clubId ? '#2563eb' : theme.text },
                ]}
              >
                {profile.club}
              </Text>
            </TouchableOpacity>
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
  addBtn: { backgroundColor: '#9A6B12', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  dualNote: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  pendingBox: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f59e0b55',
    backgroundColor: '#fffbeb',
  },
  pendingTitle: { fontSize: 13, fontWeight: '800', color: '#92400e', marginBottom: 8, textTransform: 'uppercase' },
  pendingRow: { borderColor: '#f59e0b55', backgroundColor: '#fff' },
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
  statusBadge: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  currentBadge: { fontSize: 11, fontWeight: '700', color: '#059669' },
  notes: { fontSize: 13, marginTop: 6, lineHeight: 18 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  confirmBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  confirmBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  rejectBtn: {
    borderWidth: 1,
    borderColor: '#f87171',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  rejectBtnText: { color: '#dc2626', fontWeight: '800', fontSize: 12 },
  btnDisabled: { opacity: 0.55 },
  confirmedHint: { marginTop: 8, fontSize: 12, fontWeight: '700', color: '#059669' },
  bio: { fontSize: 15, lineHeight: 22 },
  grid: { marginTop: 4 },
  gridRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  emoji: { fontSize: 18, marginRight: 10, width: 28 },
  gridText: { flex: 1, fontSize: 15 },
});
