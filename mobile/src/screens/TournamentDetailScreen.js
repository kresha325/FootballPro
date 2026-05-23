import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  extractErrorMessage,
  joinTournamentRequest,
  leaveTournamentRequest,
  tournamentByIdRequest,
  tournamentMatchDetailRequest,
  tournamentMatchesRequest,
  tournamentStandingsRequest,
  tournamentStatsRequest,
} from '../api/client';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'table', label: 'Standings' },
  { key: 'matches', label: 'Matches' },
];

function participantLabel(p, participantType) {
  const club = p?.Profile?.club;
  const name = [p?.firstName, p?.lastName].filter(Boolean).join(' ').trim();
  if (participantType === 'club') return name || club || `Club #${p?.id}`;
  if (club && name) return `${name} (${club})`;
  return name || `User #${p?.id}`;
}

export default function TournamentDetailScreen({ route, navigation }) {
  const { user } = useAuth();
  const tournamentId = route?.params?.tournamentId;
  const initialTab = route?.params?.initialTab || 'overview';

  const [tab, setTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tournament, setTournament] = useState(null);
  const [standings, setStandings] = useState(null);
  const [matches, setMatches] = useState([]);
  const [stats, setStats] = useState(null);
  const [matchModal, setMatchModal] = useState({ open: false, loading: false, data: null, error: '' });

  const loadDetail = useCallback(async () => {
    if (!tournamentId) return;
    setLoading(true);
    setError('');
    try {
      const [tRes, stRes, mRes, statRes] = await Promise.all([
        tournamentByIdRequest(tournamentId),
        tournamentStandingsRequest(tournamentId).catch(() => ({ data: null })),
        tournamentMatchesRequest(tournamentId).catch(() => ({ data: [] })),
        tournamentStatsRequest(tournamentId).catch(() => ({ data: null })),
      ]);
      setTournament(tRes.data);
      setStandings(stRes.data);
      setMatches(Array.isArray(mRes.data) ? mRes.data : []);
      setStats(statRes.data);
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not load tournament'));
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const participants = Array.isArray(tournament?.participants) ? tournament.participants : [];
  const participantCount = participants.length;
  const isJoined = participants.some((p) => String(p.id) === String(user?.id));
  const isCreator = String(tournament?.creatorId) === String(user?.id);
  const pt = tournament?.participantType || 'individual';

  const onJoin = async () => {
    try {
      await joinTournamentRequest(tournamentId);
      Alert.alert('Joined', 'You joined the tournament.');
      loadDetail();
    } catch (err) {
      Alert.alert('Join failed', extractErrorMessage(err, 'Could not join'));
    }
  };

  const onLeave = async () => {
    Alert.alert('Leave tournament', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveTournamentRequest(tournamentId);
            loadDetail();
          } catch (err) {
            Alert.alert('Error', extractErrorMessage(err, 'Could not leave'));
          }
        },
      },
    ]);
  };

  const openMatch = async (matchId) => {
    setMatchModal({ open: true, loading: true, data: null, error: '' });
    try {
      const res = await tournamentMatchDetailRequest(tournamentId, matchId);
      setMatchModal({ open: true, loading: false, data: res.data, error: '' });
    } catch (err) {
      setMatchModal({
        open: true,
        loading: false,
        data: null,
        error: extractErrorMessage(err, 'Could not load match'),
      });
    }
  };

  if (!tournamentId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Missing tournament id.</Text>
      </View>
    );
  }

  if (loading && !tournament) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  const standingRows = Array.isArray(standings?.standings)
    ? standings.standings
    : Array.isArray(standings)
      ? standings
      : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.hero}>
        <Text style={styles.title}>{tournament?.name || 'Tournament'}</Text>
        <Text style={styles.sub}>
          {tournament?.type || '—'} · {participantCount}/{tournament?.maxParticipants || '—'} · {tournament?.status}
        </Text>
        {tournament?.description ? <Text style={styles.desc}>{tournament.description}</Text> : null}
        {isCreator ? (
          <View style={styles.badgeWrap}>
            <Text style={styles.badgeText}>Creator</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        {!isJoined && tournament?.status === 'open' && participantCount < (tournament?.maxParticipants || 999) ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={onJoin}>
            <Text style={styles.primaryBtnText}>Join</Text>
          </TouchableOpacity>
        ) : null}
        {isJoined && !isCreator ? (
          <TouchableOpacity style={styles.secondaryBtn} onPress={onLeave}>
            <Text style={styles.secondaryBtnText}>Leave</Text>
          </TouchableOpacity>
        ) : null}
        {isJoined ? <Text style={styles.joinedLabel}>✓ In tournament</Text> : null}
      </View>

      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'overview' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Participants ({participantCount})</Text>
          {participants.length === 0 ? (
            <Text style={styles.muted}>No participants yet.</Text>
          ) : (
            participants.slice(0, 30).map((p) => (
              <Text key={String(p.id)} style={styles.row}>
                {participantLabel(p, pt)}
              </Text>
            ))
          )}
          {stats ? (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.cardTitle}>Stats</Text>
              <Text style={styles.muted}>{JSON.stringify(stats, null, 0).slice(0, 400)}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {tab === 'table' ? (
        <View style={styles.card}>
          {standingRows.length === 0 ? (
            <Text style={styles.muted}>No standings yet.</Text>
          ) : (
            standingRows.map((row, idx) => (
              <View key={String(row.userId || row.id || idx)} style={styles.standRow}>
                <Text style={styles.standName}>
                  #{row.position || idx + 1}{' '}
                  {row.name || participantLabel(row.user || row, pt)}
                </Text>
                <Text style={styles.standPts}>{row.points ?? row.pts ?? 0} pts</Text>
              </View>
            ))
          )}
        </View>
      ) : null}

      {tab === 'matches' ? (
        <View style={styles.card}>
          {matches.length === 0 ? (
            <Text style={styles.muted}>No matches scheduled.</Text>
          ) : (
            matches.map((m) => (
              <TouchableOpacity key={String(m.id)} style={styles.matchRow} onPress={() => openMatch(m.id)}>
                <Text style={styles.matchTitle}>
                  {participantLabel(m.homeUser, pt)} vs {participantLabel(m.awayUser, pt)}
                </Text>
                <Text style={styles.muted}>
                  {m.status} · {m.scoreHome != null ? `${m.scoreHome}-${m.scoreAway}` : 'TBD'}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      ) : null}

      <Modal visible={matchModal.open} animationType="slide" transparent onRequestClose={() => setMatchModal({ open: false })}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setMatchModal({ open: false })}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
            {matchModal.loading ? <ActivityIndicator color="#0f766e" /> : null}
            {matchModal.error ? <Text style={styles.error}>{matchModal.error}</Text> : null}
            {matchModal.data?.match ? (
              <ScrollView>
                <Text style={styles.modalTitle}>Match detail</Text>
                <Text style={styles.row}>
                  Score: {matchModal.data.match.scoreHome ?? '—'} : {matchModal.data.match.scoreAway ?? '—'}
                </Text>
                <Text style={styles.muted}>Status: {matchModal.data.match.status}</Text>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 14, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  sub: { color: '#94a3b8', marginTop: 4 },
  desc: { color: '#cbd5e1', marginTop: 8 },
  badgeWrap: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: '#7c3aed',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  primaryBtn: { backgroundColor: '#0f766e', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: { borderWidth: 1, borderColor: '#dc2626', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  secondaryBtnText: { color: '#dc2626', fontWeight: '700' },
  joinedLabel: { color: '#16a34a', fontWeight: '700' },
  tabRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#e2e8f0', alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#0f766e' },
  tabText: { color: '#334155', fontWeight: '700', fontSize: 12 },
  tabTextActive: { color: '#fff' },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
  },
  cardTitle: { fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  row: { color: '#334155', marginBottom: 4 },
  muted: { color: '#64748b', marginBottom: 6 },
  standRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  standName: { color: '#0f172a', fontWeight: '600', flex: 1 },
  standPts: { color: '#0f766e', fontWeight: '700' },
  matchRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  matchTitle: { color: '#0f172a', fontWeight: '700' },
  error: { color: '#b91c1c', marginBottom: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '70%' },
  modalClose: { alignSelf: 'flex-end', marginBottom: 8 },
  modalCloseText: { color: '#0f766e', fontWeight: '700' },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
});
