import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  extractErrorMessage,
  generateTournamentBracketRequest,
  joinTournamentRequest,
  leaveTournamentRequest,
  startTournamentRequest,
  tournamentByIdRequest,
  tournamentMatchDetailRequest,
  tournamentMatchesRequest,
  tournamentStandingsRequest,
  tournamentStatsRequest,
  updateTournamentMatchScoreRequest,
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

function TournamentStatsBlock({ stats, onOpenMatch }) {
  if (!stats || typeof stats !== 'object') return null;

  const recent = Array.isArray(stats.recentResults) ? stats.recentResults : [];

  return (
    <View style={statsStyles.wrap}>
      <Text style={statsStyles.sectionTitle}>Stats</Text>
      <View style={statsStyles.grid}>
        <View style={statsStyles.statBox}>
          <Text style={statsStyles.statLabel}>Matches</Text>
          <Text style={statsStyles.statValue}>
            {stats.finishedMatches ?? 0}/{stats.totalMatches ?? 0}
          </Text>
          <Text style={statsStyles.statHint}>finished</Text>
        </View>
        <View style={statsStyles.statBox}>
          <Text style={statsStyles.statLabel}>Goals</Text>
          <Text style={[statsStyles.statValue, statsStyles.statValueAccent]}>{stats.totalGoals ?? 0}</Text>
          <Text style={statsStyles.statHint}>in tournament</Text>
        </View>
        <View style={statsStyles.statBox}>
          <Text style={statsStyles.statLabel}>Top scorer</Text>
          <Text style={statsStyles.statValueSmall} numberOfLines={1}>
            {stats.topScorerName || '—'}
          </Text>
          <Text style={statsStyles.statHint}>{stats.topScorerGoals ?? 0} goals</Text>
        </View>
        <View style={statsStyles.statBox}>
          <Text style={statsStyles.statLabel}>Points leader</Text>
          <Text style={statsStyles.statValueSmall} numberOfLines={1}>
            {stats.topTeamName || '—'}
          </Text>
          <Text style={statsStyles.statHint}>{stats.topTeamPoints ?? 0} pts</Text>
        </View>
      </View>
      <Text style={statsStyles.summary}>
        Participants: {stats.totalParticipants ?? 0} · Scheduled: {stats.scheduledMatches ?? 0} · Avg goals
        / finished match: {stats.avgGoalsPerMatch ?? 0}
      </Text>
      {recent.length > 0 ? (
        <View style={statsStyles.recentWrap}>
          <Text style={statsStyles.recentTitle}>Recent results</Text>
          {recent.map((r) => (
            <TouchableOpacity
              key={String(r.id)}
              style={statsStyles.recentRow}
              onPress={() => onOpenMatch?.(r.id)}
            >
              <Text style={statsStyles.recentScore}>
                {r.scoreHome ?? '—'} – {r.scoreAway ?? '—'}
              </Text>
              <Text style={statsStyles.recentNames} numberOfLines={1}>
                {r.homeName || 'Home'} vs {r.awayName || 'Away'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const statsStyles = StyleSheet.create({
  wrap: { marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e2e8f0' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statBox: {
    width: '48%',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  statValueAccent: { color: '#0f766e' },
  statValueSmall: { fontSize: 13, fontWeight: '700', color: '#0f172a', textAlign: 'center' },
  statHint: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  summary: { fontSize: 13, color: '#475569', lineHeight: 19, marginTop: 10 },
  recentWrap: { marginTop: 12 },
  recentTitle: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 8, textTransform: 'uppercase' },
  recentRow: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  recentScore: { fontSize: 15, fontWeight: '800', color: '#0f172a', fontVariant: ['tabular-nums'] },
  recentNames: { fontSize: 12, color: '#64748b', marginTop: 2 },
});

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
  const [scoreHomeInput, setScoreHomeInput] = useState('');
  const [scoreAwayInput, setScoreAwayInput] = useState('');
  const [savingScore, setSavingScore] = useState(false);
  const [startingTournament, setStartingTournament] = useState(false);

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
    setScoreHomeInput('');
    setScoreAwayInput('');
    setMatchModal({ open: true, loading: true, data: null, error: '' });
    try {
      const res = await tournamentMatchDetailRequest(tournamentId, matchId);
      const m = res.data?.match;
      setScoreHomeInput(m?.scoreHome != null ? String(m.scoreHome) : '');
      setScoreAwayInput(m?.scoreAway != null ? String(m.scoreAway) : '');
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

  const isKnockoutType = tournament?.type === 'knockout' || tournament?.type === 'cup';
  const canStartTournament =
    isCreator && tournament?.status === 'open' && participantCount >= 2 && matches.length === 0;

  const onStartTournament = () => {
    Alert.alert(
      'Nis turneun',
      isKnockoutType
        ? 'Do të krijohen ndeshjet e raundit 1 (çiftëzim i pjesëmarrësve). Vazhdo?'
        : 'Do të krijohen të gjitha ndeshjet e ligës (çdo kundër çdo). Vazhdo?',
      [
        { text: 'Anulo', style: 'cancel' },
        {
          text: 'Nis',
          onPress: async () => {
            setStartingTournament(true);
            try {
              const res = await startTournamentRequest(tournamentId);
              const count = res.data?.matchesCreated ?? res.data?.matches?.length ?? 0;
              Alert.alert('Sukses', `Turneu nisi. U krijuan ${count} ndeshje.`);
              loadDetail();
              setTab('matches');
            } catch (err) {
              Alert.alert('Gabim', extractErrorMessage(err, 'Nuk u nis dot turneu'));
            } finally {
              setStartingTournament(false);
            }
          },
        },
      ]
    );
  };

  const onGenerateBracket = () => {
    Alert.alert(
      'Gjenero bracket',
      'Krijo ndeshjet e raundit 1 me bracket (knockout). Vazhdo?',
      [
        { text: 'Anulo', style: 'cancel' },
        {
          text: 'Gjenero',
          onPress: async () => {
            setStartingTournament(true);
            try {
              const res = await generateTournamentBracketRequest(tournamentId);
              const count = Array.isArray(res.data?.matches) ? res.data.matches.length : 0;
              Alert.alert('Sukses', `Bracket u gjenerua (${count} ndeshje).`);
              loadDetail();
              setTab('matches');
            } catch (err) {
              Alert.alert('Gabim', extractErrorMessage(err, 'Nuk u gjenerua dot bracket'));
            } finally {
              setStartingTournament(false);
            }
          },
        },
      ]
    );
  };

  const canEditMatchScore = (match) => {
    if (!match || match.status === 'finished') return false;
    const uid = String(user?.id);
    return (
      isCreator ||
      String(match.homeUserId) === uid ||
      String(match.awayUserId) === uid
    );
  };

  const onSaveMatchScore = async () => {
    const match = matchModal.data?.match;
    if (!match?.id) return;
    const scoreHome = Number(scoreHomeInput);
    const scoreAway = Number(scoreAwayInput);
    if (!Number.isFinite(scoreHome) || !Number.isFinite(scoreAway) || scoreHome < 0 || scoreAway < 0) {
      Alert.alert('Rezultati', 'Vendos gola të vlefshme (numra ≥ 0).');
      return;
    }
    setSavingScore(true);
    try {
      await updateTournamentMatchScoreRequest(match.id, {
        scoreHome,
        scoreAway,
        status: 'finished',
      });
      Alert.alert('Ruajtur', 'Rezultati u përditësua.');
      setMatchModal({ open: false, loading: false, data: null, error: '' });
      loadDetail();
    } catch (err) {
      Alert.alert('Gabim', extractErrorMessage(err, 'Nuk u ruajt dot rezultati'));
    } finally {
      setSavingScore(false);
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

  const standingRows = Array.isArray(standings?.rows)
    ? standings.rows
    : Array.isArray(standings?.standings)
      ? standings.standings
      : Array.isArray(standings)
        ? standings
        : [];
  const standingsCaption = standings?.caption;

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
        {canStartTournament ? (
          <TouchableOpacity
            style={[styles.startBtn, startingTournament && styles.btnDisabled]}
            onPress={onStartTournament}
            disabled={startingTournament}
          >
            {startingTournament ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.startBtnText}>Nis turneun</Text>
            )}
          </TouchableOpacity>
        ) : null}
        {isCreator && isKnockoutType && tournament?.status === 'open' && participantCount >= 2 && matches.length === 0 ? (
          <TouchableOpacity
            style={[styles.bracketBtn, startingTournament && styles.btnDisabled]}
            onPress={onGenerateBracket}
            disabled={startingTournament}
          >
            <Text style={styles.bracketBtnText}>Gjenero bracket</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {isCreator && tournament?.status === 'open' && participantCount < 2 ? (
        <Text style={styles.hint}>Duhen të paktën 2 pjesëmarrës për të nisur turneun.</Text>
      ) : null}

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
          <TournamentStatsBlock stats={stats} onOpenMatch={openMatch} />
        </View>
      ) : null}

      {tab === 'table' ? (
        <View style={styles.card}>
          {standingsCaption ? <Text style={styles.muted}>{standingsCaption}</Text> : null}
          {standingRows.length === 0 ? (
            <Text style={styles.muted}>
              {isKnockoutType
                ? 'No finished matches yet. For knockout, see Matches for the bracket; this table fills in after results are saved.'
                : 'No standings yet.'}
            </Text>
          ) : (
            standingRows.map((row, idx) => (
              <View key={String(row.userId || row.id || idx)} style={styles.standRow}>
                <Text style={styles.standName}>
                  #{row.rank ?? row.position ?? idx + 1}{' '}
                  {participantLabel(row.User || row.user || row, pt)}
                </Text>
                <Text style={styles.standPts}>
                  {row.points ?? 0} pts · {row.played ?? 0} pl · GD {row.goalDifference ?? 0}
                </Text>
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
                <Text style={styles.modalTitle}>Ndeshja</Text>
                <Text style={styles.row}>
                  {participantLabel(matchModal.data.match.homeUser, pt)} vs{' '}
                  {participantLabel(matchModal.data.match.awayUser, pt)}
                </Text>
                <Text style={styles.muted}>
                  Status: {matchModal.data.match.status}
                  {matchModal.data.match.round ? ` · Raundi ${matchModal.data.match.round}` : ''}
                </Text>
                {canEditMatchScore(matchModal.data.match) ? (
                  <View style={styles.scoreForm}>
                    <Text style={styles.scoreFormTitle}>Fut rezultatin</Text>
                    <View style={styles.scoreRow}>
                      <TextInput
                        style={styles.scoreInput}
                        keyboardType="number-pad"
                        value={scoreHomeInput}
                        onChangeText={setScoreHomeInput}
                        placeholder="Shtëpi"
                        maxLength={3}
                      />
                      <Text style={styles.scoreDash}>:</Text>
                      <TextInput
                        style={styles.scoreInput}
                        keyboardType="number-pad"
                        value={scoreAwayInput}
                        onChangeText={setScoreAwayInput}
                        placeholder="Mysafir"
                        maxLength={3}
                      />
                    </View>
                    <TouchableOpacity
                      style={[styles.primaryBtn, savingScore && styles.btnDisabled]}
                      onPress={onSaveMatchScore}
                      disabled={savingScore}
                    >
                      {savingScore ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.primaryBtnText}>Ruaj rezultatin</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.row}>
                    Rezultati: {matchModal.data.match.scoreHome ?? '—'} : {matchModal.data.match.scoreAway ?? '—'}
                  </Text>
                )}
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
  startBtn: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  startBtnText: { color: '#fff', fontWeight: '700' },
  bracketBtn: {
    borderWidth: 1,
    borderColor: '#7c3aed',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  bracketBtnText: { color: '#7c3aed', fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  hint: { color: '#64748b', fontSize: 13, marginBottom: 10, marginTop: -4 },
  scoreForm: { marginTop: 14 },
  scoreFormTitle: { fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 },
  scoreInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    width: 72,
    paddingVertical: 10,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  scoreDash: { fontSize: 22, fontWeight: '800', color: '#64748b' },
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
