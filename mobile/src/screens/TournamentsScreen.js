import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ListSearchBar from '../components/ListSearchBar';
import { filterBySearch } from '../utils/listSearch';
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
} from 'react-native';
import {
  createTournamentRequest,
  extractErrorMessage,
  joinTournamentRequest,
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

function TournamentCard({ item, user, onJoin, onOpen }) {
  const participants = Array.isArray(item?.participants) ? item.participants.length : 0;
  const isJoined = Array.isArray(item?.participants) && item.participants.some((p) => String(p.id) === String(user?.id));

  return (
    <View style={styles.card}>
      <Text style={styles.name}>{formatTournamentTitle(item)}</Text>
      <Text style={styles.description}>{item?.description || 'No description'}</Text>
      <Text style={styles.meta}>
        Type: {item?.type || 'N/A'} | Status: {item?.status || 'open'}
        {item?.season ? ` | Season: ${item.season}` : ''}
      </Text>
      <Text style={styles.meta}>Participants: {participants}/{item?.maxParticipants || '-'}</Text>
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.detailBtn} onPress={() => onOpen(item)}>
          <Text style={styles.detailBtnText}>Details</Text>
        </TouchableOpacity>
        {!isJoined ? (
          <TouchableOpacity style={styles.joinBtn} onPress={() => onJoin(item.id)}>
            <Text style={styles.joinBtnText}>Join</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.joinedTag}>Joined</Text>
        )}
      </View>
    </View>
  );
}

export default function TournamentsScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [trending, setTrending] = useState([]);
  const [allTournaments, setAllTournaments] = useState([]);
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
  });

  const seasonPreview = previewTournamentSeason(form.type, form.startDate);

  const loadData = useCallback(async ({ silent } = { silent: false }) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [trendingRes, allRes] = await Promise.all([trendingTournamentsRequest(), tournamentsRequest()]);
      setTrending(Array.isArray(trendingRes.data) ? trendingRes.data : []);
      setAllTournaments(Array.isArray(allRes.data) ? allRes.data : []);
      setVisibleCount(PAGE_SIZE);
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not load tournaments'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onJoin = async (tournamentId) => {
    try {
      await joinTournamentRequest(tournamentId);
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
    if (!form.name.trim()) {
      Alert.alert('Validation', 'Tournament name is required.');
      return;
    }
    setCreating(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        type: form.type,
        maxParticipants: Number(form.maxParticipants) || 8,
        participantType: form.participantType,
      };
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
    const base = [...trending, ...allTournaments.filter((t) => !trending.some((tr) => tr.id === t.id))];
    return filterBySearch(base, listSearch, (t) => [
      t.name,
      t.description,
      t.type,
      t.season,
      t.status,
      formatTournamentTitle(t),
    ]);
  }, [trending, allTournaments, listSearch]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
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
            colors={['#0f766e']}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.headerCard}>
              <Text style={styles.headerTitle}>Tournaments</Text>
              <Text style={styles.headerSub}>Browse, join, or create a tournament.</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <TouchableOpacity style={styles.createHeaderBtn} onPress={() => setShowCreate(true)}>
                <Text style={styles.createHeaderBtnText}>+ Create tournament</Text>
              </TouchableOpacity>
            </View>
            <ListSearchBar
              value={listSearch}
              onChangeText={setListSearch}
              placeholder="Kërko turne…"
              onGlobalPress={() => navigation.navigate('Search', { initialQuery: listSearch })}
            />
          </View>
        }
        renderItem={({ item }) => (
          <TournamentCard item={item} user={user} onJoin={onJoin} onOpen={onOpen} />
        )}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (visibleCount < merged.length) {
            setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, merged.length));
          }
        }}
        ListFooterComponent={visibleCount < merged.length ? <Text style={styles.footer}>Loading more...</Text> : null}
        ListEmptyComponent={<Text style={styles.empty}>No tournaments available.</Text>}
      />

      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Create tournament</Text>
              <TextInput
                style={styles.input}
                placeholder="Name"
                placeholderTextColor="#94a3b8"
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              />
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description"
                placeholderTextColor="#94a3b8"
                value={form.description}
                onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                multiline
              />
              <TextInput
                style={styles.input}
                placeholder="Start date (YYYY-MM-DD)"
                placeholderTextColor="#94a3b8"
                value={form.startDate}
                onChangeText={(v) => setForm((f) => ({ ...f, startDate: v }))}
              />
              <Text style={styles.seasonPreview}>
                {seasonLabel(form.type)}: {seasonPreview || '—'}
                {form.type === 'league'
                  ? ' (gusht–korrik, si FIFA)'
                  : ' (viti i edicionit)'}
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
              <Text style={styles.label}>Participants: {form.participantType}</Text>
              <View style={styles.chipRow}>
                {['individual', 'club', 'mixed'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chip, form.participantType === t && styles.chipActive]}
                    onPress={() => setForm((f) => ({ ...f, participantType: t }))}
                  >
                    <Text style={[styles.chipText, form.participantType === t && styles.chipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreate(false)} disabled={creating}>
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
    backgroundColor: '#0f766e',
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
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  detailBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#0f766e',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  detailBtnText: { color: '#0f766e', fontWeight: '700' },
  joinBtn: { flex: 1, backgroundColor: '#0f766e', borderRadius: 8, alignItems: 'center', paddingVertical: 9 },
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
  seasonPreview: { color: '#0f766e', fontWeight: '700', marginBottom: 10, fontSize: 13 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f1f5f9' },
  chipActive: { backgroundColor: '#0f766e' },
  chipText: { color: '#334155', fontWeight: '600', fontSize: 12 },
  chipTextActive: { color: '#fff' },
  modalActions: { flexDirection: 'row', gap: 8 },
  cancelBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1' },
  cancelBtnText: { color: '#475569', fontWeight: '700' },
  saveBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: '#0f766e' },
  saveBtnText: { color: '#fff', fontWeight: '700' },
});
