import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  extractErrorMessage,
  joinTournamentRequest,
  tournamentsRequest,
  trendingTournamentsRequest,
} from '../api/client';

const PAGE_SIZE = 8;

function TournamentCard({ item, onJoin }) {
  const participants = Array.isArray(item?.participants) ? item.participants.length : 0;

  return (
    <View style={styles.card}>
      <Text style={styles.name}>{item?.name || 'Tournament'}</Text>
      <Text style={styles.description}>{item?.description || 'No description'}</Text>
      <Text style={styles.meta}>
        Type: {item?.type || 'N/A'} |{' '}
        {(item?.participantType || 'individual') === 'club'
          ? 'Vetëm klube'
          : (item?.participantType || 'individual') === 'mixed'
            ? 'Klub+atlet'
            : 'Individë'}{' '}
        | Status:{' '}
        {item?.status || 'open'}
      </Text>
      <Text style={styles.meta}>Participants: {participants}/{item?.maxParticipants || '-'}</Text>
      <TouchableOpacity style={styles.joinBtn} onPress={() => onJoin(item.id)}>
        <Text style={styles.joinBtnText}>Join</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function TournamentsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [trending, setTrending] = useState([]);
  const [allTournaments, setAllTournaments] = useState([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  const merged = [...trending, ...allTournaments.filter((t) => !trending.some((tr) => tr.id === t.id))];

  return (
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
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>Trending & All Tournaments</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      }
      renderItem={({ item }) => <TournamentCard item={item} onJoin={onJoin} />}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (visibleCount < merged.length) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, merged.length));
        }
      }}
      ListFooterComponent={visibleCount < merged.length ? <Text style={styles.footer}>Loading more...</Text> : null}
      ListEmptyComponent={<Text style={styles.empty}>No tournaments available.</Text>}
    />
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
  headerTitle: { color: '#155e75', fontWeight: '800' },
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
  joinBtn: { marginTop: 6, backgroundColor: '#0f766e', borderRadius: 8, alignItems: 'center', paddingVertical: 9 },
  joinBtnText: { color: '#fff', fontWeight: '700' },
  error: { marginTop: 6, color: '#b91c1c' },
  footer: { textAlign: 'center', color: '#64748b', marginVertical: 10 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 20 },
});
