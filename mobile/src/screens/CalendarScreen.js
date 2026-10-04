import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from '../theme/nativeComponents';
import { useNavigation } from '@react-navigation/native';
import { calendarRequest, extractErrorMessage } from '../api/client';

const VIEWS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'completed', label: 'Completed' },
];

export default function CalendarScreen() {
  const navigation = useNavigation();
  const [view, setView] = useState('upcoming');
  const [competitionId, setCompetitionId] = useState('');
  const [season, setSeason] = useState('');
  const [clubId, setClubId] = useState('');
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const params = { view };
      if (competitionId) params.competitionId = competitionId;
      if (season) params.season = season;
      if (clubId) params.clubId = clubId;
      const res = await calendarRequest(params);
      setMatches(Array.isArray(res?.data?.matches) ? res.data.matches : []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Calendar failed to load'));
      setMatches([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [view, competitionId, season, clubId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <Text style={styles.title}>Match calendar</Text>
      <View style={styles.row}>
        {VIEWS.map((item) => (
          <TouchableOpacity key={item.id} style={[styles.chip, view === item.id && styles.chipOn]} onPress={() => setView(item.id)}>
            <Text style={styles.chipText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput value={competitionId} onChangeText={setCompetitionId} placeholder="Competition ID" placeholderTextColor="#94a3b8" style={styles.input} />
      <TextInput value={season} onChangeText={setSeason} placeholder="Season" placeholderTextColor="#94a3b8" style={styles.input} />
      <TextInput value={clubId} onChangeText={setClubId} placeholder="Club / team user ID" placeholderTextColor="#94a3b8" style={styles.input} />
      {loading ? <ActivityIndicator /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && matches.length === 0 ? <Text style={styles.empty}>No matches for this view.</Text> : null}
      {matches.map((match) => (
        <TouchableOpacity key={String(match.id)} style={styles.card} onPress={() => navigation.navigate('MatchDetail', { matchId: match.id })}>
          <Text style={styles.teams}>{match.homeName || 'Home'} vs {match.awayName || 'Away'}</Text>
          <Text style={styles.meta}>{match.Tournament?.name || 'Competition'} · {match.status}</Text>
          <Text style={styles.meta}>{match.scoreHome ?? '–'} : {match.scoreAway ?? '–'}</Text>
          <Text style={styles.meta}>{match.matchDate ? new Date(match.matchDate).toLocaleString() : 'No date'}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, gap: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#e2e8f0' },
  chipOn: { backgroundColor: '#f5d48a' },
  chipText: { color: '#0f172a', fontWeight: '600' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 10, color: '#0f172a' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  teams: { fontWeight: '700', color: '#0f172a' },
  meta: { color: '#475569', marginTop: 2 },
  empty: { color: '#64748b', marginTop: 12 },
  error: { color: '#b91c1c' },
});
