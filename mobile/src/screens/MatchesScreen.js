import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  createMatchRequest,
  extractErrorMessage,
  matchesRequest,
  tournamentByIdRequest,
  tournamentsRequest,
  updateMatchRequest,
  updateMatchScoreRequest,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import ListSearchBar from '../components/ListSearchBar';
import { filterBySearch } from '../utils/listSearch';

const CREATOR_ROLES = new Set(['admin', 'coach', 'manager', 'club', 'federation']);

export default function MatchesScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    tournamentId: '',
    homeUserId: '',
    awayUserId: '',
    round: '1',
    matchDate: new Date().toISOString().slice(0, 16),
  });
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [scoreForm, setScoreForm] = useState({ matchId: '', scoreHome: '', scoreAway: '' });
  const [listSearch, setListSearch] = useState('');

  const canCreate = CREATOR_ROLES.has(user?.role);

  const loadData = useCallback(async ({ silent } = { silent: false }) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [matchRes, tournamentRes] = await Promise.all([matchesRequest(), tournamentsRequest()]);
      setMatches(Array.isArray(matchRes?.data) ? matchRes.data : []);
      setTournaments(Array.isArray(tournamentRes?.data) ? tournamentRes.data : []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not load matches'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const tournamentId = Number(form.tournamentId);
    if (!tournamentId) {
      setParticipants([]);
      return;
    }

    let canceled = false;
    tournamentByIdRequest(tournamentId)
      .then((res) => {
        if (canceled) return;
        const list = res?.data?.participants || [];
        setParticipants(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!canceled) setParticipants([]);
      });

    return () => {
      canceled = true;
    };
  }, [form.tournamentId]);

  const upcoming = useMemo(() => {
    const now = new Date();
    const base = matches.filter((m) => new Date(m?.scheduledAt || m?.matchDate || 0) > now);
    return filterBySearch(base, listSearch, (m) => [
      m.homeTeam,
      m.awayTeam,
      m.location,
      m.status,
      m.Tournament?.name,
      m.homeUser?.firstName,
      m.homeUser?.lastName,
      m.awayUser?.firstName,
      m.awayUser?.lastName,
    ]);
  }, [matches, listSearch]);

  const handleCreate = async () => {
    if (!form.tournamentId || !form.homeUserId || !form.awayUserId) {
      setError('Select tournament and both players first');
      return;
    }
    if (form.homeUserId === form.awayUserId) {
      setError('Home and away player cannot be the same');
      return;
    }
    setError('');
    try {
      await createMatchRequest({
        tournamentId: Number(form.tournamentId),
        homeUserId: Number(form.homeUserId),
        awayUserId: Number(form.awayUserId),
        round: Number(form.round || 1),
        matchDate: form.matchDate,
      });
      setForm({ tournamentId: '', homeUserId: '', awayUserId: '', round: '1', matchDate: new Date().toISOString().slice(0, 16) });
      setParticipants([]);
      setEditingMatchId(null);
      loadData({ silent: true });
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to schedule match'));
    }
  };

  const handleSaveEdit = async () => {
    if (!editingMatchId) return;
    try {
      await updateMatchRequest(editingMatchId, {
        tournamentId: Number(form.tournamentId),
        homeUserId: Number(form.homeUserId),
        awayUserId: Number(form.awayUserId),
        round: Number(form.round || 1),
        matchDate: form.matchDate,
      });
      setEditingMatchId(null);
      setForm({ tournamentId: '', homeUserId: '', awayUserId: '', round: '1', matchDate: new Date().toISOString().slice(0, 16) });
      setParticipants([]);
      loadData({ silent: true });
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to update match'));
    }
  };

  const handleUpdateScore = async () => {
    if (!scoreForm.matchId) {
      setError('Choose a match first for score update');
      return;
    }
    try {
      await updateMatchScoreRequest(Number(scoreForm.matchId), {
        scoreHome: Number(scoreForm.scoreHome),
        scoreAway: Number(scoreForm.scoreAway),
      });
      setScoreForm({ matchId: '', scoreHome: '', scoreAway: '' });
      loadData({ silent: true });
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to update score'));
    }
  };

  return (
    <FlatList
      data={upcoming}
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
            <Text style={styles.headerTitle}>Matches</Text>
            <Text style={styles.headerSub}>Upcoming fixtures and scheduling</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
          <ListSearchBar
            value={listSearch}
            onChangeText={setListSearch}
            placeholder="Kërko ndeshje…"
            onGlobalPress={() => navigation.navigate('Search', { initialQuery: listSearch })}
          />

          {canCreate ? (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Schedule Match</Text>
              <TextInput
                value={form.tournamentId}
                onChangeText={(v) => setForm((prev) => ({ ...prev, tournamentId: v, homeUserId: '', awayUserId: '' }))}
                placeholder={`Tournament ID (${tournaments.length} available)`}
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                style={styles.input}
              />
              <TextInput
                value={form.homeUserId}
                onChangeText={(v) => setForm((prev) => ({ ...prev, homeUserId: v }))}
                placeholder="Home User ID"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                style={styles.input}
              />
              <TextInput
                value={form.awayUserId}
                onChangeText={(v) => setForm((prev) => ({ ...prev, awayUserId: v }))}
                placeholder="Away User ID"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                style={styles.input}
              />
              <TextInput
                value={form.round}
                onChangeText={(v) => setForm((prev) => ({ ...prev, round: v }))}
                placeholder="Round"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                style={styles.input}
              />
              <TextInput
                value={form.matchDate}
                onChangeText={(v) => setForm((prev) => ({ ...prev, matchDate: v }))}
                placeholder="Match date: YYYY-MM-DDTHH:mm"
                placeholderTextColor="#94a3b8"
                style={styles.input}
              />
              {participants.length > 0 ? (
                <Text style={styles.helper}>Participants loaded: {participants.length} (use these IDs)</Text>
              ) : null}
              <TouchableOpacity style={styles.primaryBtn} onPress={editingMatchId ? handleSaveEdit : handleCreate}>
                <Text style={styles.primaryBtnText}>{editingMatchId ? 'Save Match' : 'Create Match'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {canCreate ? (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Update Score</Text>
              <TextInput
                value={scoreForm.matchId}
                onChangeText={(v) => setScoreForm((s) => ({ ...s, matchId: v }))}
                placeholder="Match ID"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                style={styles.input}
              />
              <TextInput
                value={scoreForm.scoreHome}
                onChangeText={(v) => setScoreForm((s) => ({ ...s, scoreHome: v }))}
                placeholder="Home score"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                style={styles.input}
              />
              <TextInput
                value={scoreForm.scoreAway}
                onChangeText={(v) => setScoreForm((s) => ({ ...s, scoreAway: v }))}
                placeholder="Away score"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                style={styles.input}
              />
              <TouchableOpacity style={styles.primaryBtn} onPress={handleUpdateScore}>
                <Text style={styles.primaryBtnText}>Update Score</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>Upcoming ({upcoming.length})</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.matchCard}>
          <Text style={styles.teams}>{item?.homeTeam || item?.homeUser?.firstName || 'Home'} vs {item?.awayTeam || item?.awayUser?.firstName || 'Away'}</Text>
          <Text style={styles.meta}>ID: {item?.id || '-'}</Text>
          <Text style={styles.meta}>Round: {item?.round || '-'}</Text>
          <Text style={styles.meta}>Date: {new Date(item?.scheduledAt || item?.matchDate || Date.now()).toLocaleString()}</Text>
          <Text style={styles.meta}>Status: {item?.status || 'scheduled'}</Text>
          {canCreate ? (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => {
                setEditingMatchId(item?.id || null);
                setForm({
                  tournamentId: String(item?.tournamentId || ''),
                  homeUserId: String(item?.homeUserId || ''),
                  awayUserId: String(item?.awayUserId || ''),
                  round: String(item?.round || '1'),
                  matchDate: String(item?.matchDate || '').slice(0, 16),
                });
                setScoreForm((s) => ({ ...s, matchId: String(item?.id || '') }));
              }}
            >
              <Text style={styles.editBtnText}>Edit Match</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
      ListEmptyComponent={!loading ? <Text style={styles.empty}>No upcoming matches.</Text> : null}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 14, paddingBottom: 30, backgroundColor: '#f8fafc', minHeight: '100%' },
  headerCard: {
    backgroundColor: '#ecfeff',
    borderWidth: 1,
    borderColor: '#a5f3fc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  headerTitle: { color: '#0f172a', fontWeight: '800', fontSize: 20 },
  headerSub: { color: '#155e75', marginTop: 4 },
  formCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  formTitle: { color: '#0f172a', fontWeight: '700', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
    color: '#0f172a',
  },
  primaryBtn: { backgroundColor: '#0f766e', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  editBtn: { marginTop: 8, backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  editBtnText: { color: '#fff', fontWeight: '700' },
  helper: { color: '#475569', marginBottom: 8 },
  sectionTitle: { color: '#0f172a', fontWeight: '800', marginVertical: 8 },
  matchCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  teams: { color: '#0f172a', fontWeight: '800' },
  meta: { color: '#475569', marginTop: 4 },
  error: { color: '#b91c1c', marginTop: 8 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 20 },
});
