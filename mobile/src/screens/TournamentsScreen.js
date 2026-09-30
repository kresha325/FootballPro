import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ListSearchBar from '../components/ListSearchBar';
import { filterBySearch } from '../utils/listSearch';
import { useRoute } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from '../theme/nativeComponents';
import {
  createTournamentRequest,
  extractErrorMessage,
  joinTournamentRequest,
  profileTournamentSummaryRequest,
  tournamentsRequest,
  trendingTournamentsRequest,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  formatTournamentTitle,
  previewTournamentSeason,
  seasonLabel,
  todayDateInputValue,
} from '../utils/footballSeason';

const PAGE_SIZE = 8;

function isLigaTournament(item) {
  return !!(item?.ligaId || item?.sourceRole === 'liga');
}

function canUserJoinTournament(item, user) {
  if (!user?.id || !item) return false;
  const pt = item.participantType || 'individual';
  if (user.role === 'athlete' && isLigaTournament(item)) return false;
  if (pt === 'club' && user.role !== 'club') return false;
  if (pt === 'mixed' && !['club', 'athlete'].includes(user.role)) return false;
  if (pt === 'individual' && user.role === 'club') return false;
  return true;
}

function TournamentCard({ item, user, onJoin, onOpen, mineOnly }) {
  const participants = Array.isArray(item?.participants) ? item.participants.length : 0;
  const isJoined =
    item?.isJoined === true ||
    (Array.isArray(item?.participants) &&
      item.participants.some((p) => String(p.id || p.userId) === String(user?.id)));
  const showJoin = !mineOnly && !isJoined && item?.status === 'open' && canUserJoinTournament(item, user);
  const athleteLigaBlocked = user?.role === 'athlete' && isLigaTournament(item) && !isJoined;

  return (
    <View style={styles.card}>
      <Text style={styles.name}>{formatTournamentTitle(item)}</Text>
      <Text style={styles.description}>{item?.description || 'No description'}</Text>
      <Text style={styles.meta}>
        Type: {item?.type || 'N/A'} | Status: {item?.status || 'open'}
        {item?.season ? ` | Season: ${item.season}` : ''}
      </Text>
      <Text style={styles.meta}>
        Participants: {participants}/{item?.maxParticipants || '-'}
      </Text>
      {athleteLigaBlocked ? (
        <Text style={styles.hint}>Pjesëmarrja e atletëve bëhet përmes klubit (jo Join).</Text>
      ) : null}
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.detailBtn} onPress={() => onOpen(item)}>
          <Text style={styles.detailBtnText}>Details</Text>
        </TouchableOpacity>
        {showJoin ? (
          <TouchableOpacity style={styles.joinBtn} onPress={() => onJoin(item)}>
            <Text style={styles.joinBtnText}>Join</Text>
          </TouchableOpacity>
        ) : isJoined ? (
          <Text style={styles.joinedTag}>Joined</Text>
        ) : null}
      </View>
    </View>
  );
}

export default function TournamentsScreen({ navigation }) {
  const route = useRoute();
  const { user } = useAuth();
  const mineOnly = route?.params?.filter === 'mine';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [trending, setTrending] = useState([]);
  const [allTournaments, setAllTournaments] = useState([]);
  const [myTournamentIds, setMyTournamentIds] = useState([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [listSearch, setListSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'knockout',
    startDate: todayDateInputValue(),
    maxParticipants: 8,
    participantType: 'individual',
    category: 'open',
  });

  const canCreateTournament = ['liga', 'club', 'scout'].includes(user?.role);
  const isLigaCreator = user?.role === 'liga';

  const seasonPreview = previewTournamentSeason(form.type, form.startDate);

  const loadData = useCallback(
    async ({ silent } = { silent: false }) => {
      if (!silent) setLoading(true);
      setError('');
      try {
        if (mineOnly && user?.id) {
          const [summaryRes, allRes] = await Promise.all([
            profileTournamentSummaryRequest(user.id),
            tournamentsRequest().catch(() => ({ data: [] })),
          ]);
          const summaryRows = Array.isArray(summaryRes?.data?.tournaments)
            ? summaryRes.data.tournaments
            : [];
          const ids = summaryRows.map((r) => r.tournamentId).filter(Boolean);
          setMyTournamentIds(ids.map(String));
          const all = Array.isArray(allRes.data) ? allRes.data : [];
          const byId = Object.fromEntries(all.map((t) => [String(t.id), t]));
          const mineList = summaryRows.map((row) => {
            const full = byId[String(row.tournamentId)];
            if (full) {
              return { ...full, isJoined: true, viaSquad: !!row.viaSquad };
            }
            return {
              id: row.tournamentId,
              name: row.tournamentName,
              description: row.tournamentDescription,
              type: row.tournamentType,
              status: row.tournamentStatus,
              season: row.tournamentSeason,
              category: row.tournamentCategory,
              participants: [],
              isJoined: true,
              viaSquad: !!row.viaSquad,
            };
          });
          setTrending([]);
          setAllTournaments(mineList);
        } else {
          const [trendingRes, allRes, summaryRes] = await Promise.all([
            trendingTournamentsRequest(),
            tournamentsRequest(),
            user?.id
              ? profileTournamentSummaryRequest(user.id).catch(() => ({ data: { tournaments: [] } }))
              : Promise.resolve({ data: { tournaments: [] } }),
          ]);
          const summaryRows = Array.isArray(summaryRes?.data?.tournaments)
            ? summaryRes.data.tournaments
            : [];
          setMyTournamentIds(summaryRows.map((r) => String(r.tournamentId)).filter(Boolean));
          setTrending(Array.isArray(trendingRes.data) ? trendingRes.data : []);
          setAllTournaments(Array.isArray(allRes.data) ? allRes.data : []);
        }
        setVisibleCount(PAGE_SIZE);
      } catch (err) {
        setError(extractErrorMessage(err, 'Could not load tournaments'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [mineOnly, user?.id]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onJoin = async (item) => {
    if (!canUserJoinTournament(item, user)) {
      Alert.alert(
        'Nuk mund të bashkoheni',
        user?.role === 'athlete' && isLigaTournament(item)
          ? 'Atletët marrin pjesë në turnet e ligës përmes klubit, jo me Join.'
          : 'Ky turne nuk lejon bashkimin për rolin tuaj.'
      );
      return;
    }
    try {
      await joinTournamentRequest(item.id, { athleteIds: [] });
      Alert.alert('Joined', 'You joined the tournament.');
      await loadData({ silent: true });
    } catch (err) {
      Alert.alert('Join failed', extractErrorMessage(err, 'Could not join tournament'));
    }
  };

  const onOpen = (item) => {
    navigation.navigate('TournamentDetail', { tournamentId: item.id, initialTab: 'overview' });
  };

  const onCreate = async () => {
    if (!canCreateTournament) {
      Alert.alert('Permission', 'Only liga, club, or scout can create tournaments.');
      return;
    }
    if (!isLigaCreator && !form.name.trim()) {
      Alert.alert('Validation', 'Tournament name is required.');
      return;
    }
    const maxN = parseInt(String(form.maxParticipants), 10);
    if (!Number.isFinite(maxN) || maxN < 2 || maxN > 500) {
      Alert.alert('Validation', 'Vendos numrin e pjesëmarrësve (2–500), p.sh. 7.');
      return;
    }
    setCreating(true);
    try {
      const payload = {
        description: form.description.trim(),
        type: form.type,
        maxParticipants: maxN,
        participantType: form.participantType || 'individual',
        category: form.category || 'open',
      };
      if (!isLigaCreator) {
        payload.name = form.name.trim();
      }
      if (form.startDate.trim()) {
        payload.startDate = form.startDate.trim();
      }
      await createTournamentRequest(payload);
      setShowCreate(false);
      setForm({
        name: '',
        description: '',
        type: 'knockout',
        startDate: todayDateInputValue(),
        maxParticipants: 8,
        participantType: 'individual',
        category: 'open',
      });
      await loadData({ silent: true });
      Alert.alert('Created', 'Tournament created successfully.');
    } catch (err) {
      Alert.alert('Error', extractErrorMessage(err, 'Could not create tournament'));
    } finally {
      setCreating(false);
    }
  };

  const merged = useMemo(() => {
    const base = mineOnly
      ? allTournaments
      : [...trending, ...allTournaments.filter((t) => !trending.some((tr) => tr.id === t.id))];
    const withJoined = base.map((t) => ({
      ...t,
      isJoined:
        t.isJoined === true ||
        myTournamentIds.includes(String(t.id)) ||
        (Array.isArray(t.participants) &&
          t.participants.some((p) => String(p.id || p.userId) === String(user?.id))),
    }));
    return filterBySearch(withJoined, listSearch, (t) => [
      t.name,
      t.description,
      t.type,
      t.season,
      t.status,
      formatTournamentTitle(t),
    ]);
  }, [trending, allTournaments, listSearch, mineOnly, myTournamentIds, user?.id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#9A6B12" />
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={merged.slice(0, visibleCount)}
        keyExtractor={(item, idx) => String(item?.id || idx)}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData({ silent: true });
            }}
            colors={['#9A6B12']}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.headerCard}>
              <Text style={styles.headerTitle}>{mineOnly ? 'Turnetë e mia' : 'Tournaments'}</Text>
              <Text style={styles.headerSub}>
                {mineOnly
                  ? 'Vetëm turnet ku merrni pjesë (si klub, atlet i skuadrës, ose pjesëmarrës).'
                  : canCreateTournament
                    ? 'Browse, join, or create a tournament.'
                    : 'Browse and join tournaments. Only liga, club, or scout can create.'}
              </Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {!mineOnly && canCreateTournament ? (
                <TouchableOpacity style={styles.createHeaderBtn} onPress={() => setShowCreate(true)}>
                  <Text style={styles.createHeaderBtnText}>+ Create tournament</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <ListSearchBar
              value={listSearch}
              onChangeText={setListSearch}
              placeholder={mineOnly ? 'Kërko te turnetë e mia…' : 'Kërko turne…'}
            />
          </View>
        }
        renderItem={({ item }) => (
          <TournamentCard item={item} user={user} onJoin={onJoin} onOpen={onOpen} mineOnly={mineOnly} />
        )}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (visibleCount < merged.length) {
            setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, merged.length));
          }
        }}
        ListFooterComponent={
          visibleCount < merged.length ? <Text style={styles.footer}>Loading more...</Text> : null
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {mineOnly ? 'Ende nuk jeni në asnjë turne.' : 'No tournaments available.'}
          </Text>
        }
      />

      <Modal
        visible={showCreate && canCreateTournament}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreate(false)}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Create tournament</Text>
              {isLigaCreator ? (
                <Text style={styles.seasonPreview}>Liga tournaments use your liga name automatically.</Text>
              ) : (
                <TextInput
                  style={styles.input}
                  placeholder="Name"
                  placeholderTextColor="#94a3b8"
                  value={form.name}
                  onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                />
              )}
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description"
                placeholderTextColor="#94a3b8"
                value={form.description}
                onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                multiline
              />
              <Text style={styles.label}>Category: {form.category}</Text>
              <View style={styles.chipRow}>
                {['open', 'senior', 'u11', 'u10', 'u9', 'u13', 'u15', 'u17', 'u19'].map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, form.category === c && styles.chipActive]}
                    onPress={() => setForm((f) => ({ ...f, category: c }))}
                  >
                    <Text style={[styles.chipText, form.category === c && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.input}
                placeholder="Start date (YYYY-MM-DD)"
                placeholderTextColor="#94a3b8"
                value={form.startDate}
                onChangeText={(v) => setForm((f) => ({ ...f, startDate: v }))}
              />
              <Text style={styles.seasonPreview}>
                {seasonLabel(form.type)}: {seasonPreview || '—'}
                {form.type === 'league' ? ' (gusht–korrik, si FIFA)' : ' (viti i edicionit)'}
              </Text>
              <Text style={styles.label}>Type: {form.type}</Text>
              <View style={styles.chipRow}>
                {['knockout', 'league', 'cup'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chip, form.type === t && styles.chipActive]}
                    onPress={() => setForm((f) => ({ ...f, type: t }))}
                  >
                    <Text style={[styles.chipText, form.type === t && styles.chipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Pjesëmarrja</Text>
              <View style={styles.chipRow}>
                {[
                  { value: 'individual', label: 'Individë' },
                  { value: 'club', label: 'Klube' },
                  { value: 'mixed', label: 'Klube + athletë' },
                ].map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.chip, form.participantType === t.value && styles.chipActive]}
                    onPress={() => setForm((f) => ({ ...f, participantType: t.value }))}
                  >
                    <Text
                      style={[styles.chipText, form.participantType === t.value && styles.chipTextActive]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Numri i pjesëmarrësve</Text>
              <TextInput
                style={styles.input}
                placeholder="p.sh. 7"
                placeholderTextColor="#94a3b8"
                keyboardType="number-pad"
                value={String(form.maxParticipants ?? '')}
                onChangeText={(v) =>
                  setForm((f) => ({ ...f, maxParticipants: v.replace(/[^\d]/g, '') }))
                }
              />
              <View style={styles.chipRow}>
                {[4, 6, 7, 8, 10, 12, 14, 16, 18, 20].map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.chip, Number(form.maxParticipants) === n && styles.chipActive]}
                    onPress={() => setForm((f) => ({ ...f, maxParticipants: String(n) }))}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        Number(form.maxParticipants) === n && styles.chipTextActive,
                      ]}
                    >
                      {n}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setShowCreate(false)}
                  disabled={creating}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={onCreate} disabled={creating}>
                  <Text style={styles.saveBtnText}>{creating ? 'Saving...' : 'Create'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  content: { padding: 14, paddingBottom: 30, backgroundColor: '#f8fafc', minHeight: '100%' },
  headerCard: {
    backgroundColor: '#ecfeff',
    borderWidth: 1,
    borderColor: '#a5f3fc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  headerTitle: { color: '#0f172a', fontWeight: '800', fontSize: 18 },
  headerSub: { color: '#155e75', marginTop: 4 },
  createHeaderBtn: {
    marginTop: 10,
    backgroundColor: '#9A6B12',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  createHeaderBtnText: { color: '#fff', fontWeight: '700' },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  name: { color: '#0f172a', fontWeight: '800' },
  description: { color: '#475569', marginTop: 4, marginBottom: 6 },
  meta: { color: '#64748b', marginBottom: 4 },
  hint: { color: '#b45309', fontSize: 12, marginTop: 2, marginBottom: 4 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  detailBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#9A6B12',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  detailBtnText: { color: '#9A6B12', fontWeight: '700' },
  joinBtn: { flex: 1, backgroundColor: '#9A6B12', borderRadius: 8, alignItems: 'center', paddingVertical: 9 },
  joinBtnText: { color: '#fff', fontWeight: '700' },
  joinedTag: { color: '#16a34a', fontWeight: '700', paddingHorizontal: 8 },
  error: { marginTop: 6, color: '#b91c1c' },
  footer: { textAlign: 'center', color: '#64748b', marginVertical: 10 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 20 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 16 },
  modalScroll: { flexGrow: 1, justifyContent: 'center' },
  modalCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12, color: '#0f172a' },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    color: '#0f172a',
  },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  label: { color: '#475569', fontWeight: '600', marginBottom: 6 },
  seasonPreview: { color: '#9A6B12', fontWeight: '700', marginBottom: 10, fontSize: 13 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f1f5f9' },
  chipActive: { backgroundColor: '#9A6B12' },
  chipText: { color: '#334155', fontWeight: '600', fontSize: 12 },
  chipTextActive: { color: '#fff' },
  modalActions: { flexDirection: 'row', gap: 8 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  cancelBtnText: { color: '#475569', fontWeight: '700' },
  saveBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: '#9A6B12' },
  saveBtnText: { color: '#fff', fontWeight: '700' },
});
