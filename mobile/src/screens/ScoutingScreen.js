import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { extractErrorMessage, scoutingRecommendationsRequest } from '../api/client';

function RecommendationCard({ item }) {
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{item?.playerName || 'Player'}</Text>
      <Text style={styles.meta}>Position: {item?.position || 'N/A'} | Club: {item?.club || 'N/A'}</Text>
      <Text style={styles.meta}>Score: {item?.score || 0} ({item?.percentage || 0}%)</Text>
      <Text style={styles.reasons}>Reasons: {Array.isArray(item?.reasons) ? item.reasons.slice(0, 3).join(' | ') : 'N/A'}</Text>
    </View>
  );
}

export default function ScoutingScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [position, setPosition] = useState('');
  const [recommendations, setRecommendations] = useState([]);

  const loadData = useCallback(async ({ silent, customPosition } = { silent: false, customPosition: '' }) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await scoutingRecommendationsRequest({
        position: customPosition !== undefined ? customPosition : position,
        limit: 20,
      });
      setRecommendations(Array.isArray(res?.data?.recommendations) ? res.data.recommendations : []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not load scouting recommendations'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [position]);

  useEffect(() => {
    loadData({ customPosition: '' });
  }, [loadData]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <FlatList
      data={recommendations}
      keyExtractor={(item, idx) => String(item?.playerId || idx)}
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
        <View style={styles.filterCard}>
          <Text style={styles.filterTitle}>Scouting Filters</Text>
          <TextInput
            style={styles.input}
            placeholder="Position (e.g. Forward)"
            value={position}
            onChangeText={setPosition}
          />
          <TouchableOpacity style={styles.filterBtn} onPress={() => loadData({ silent: true, customPosition: position })}>
            <Text style={styles.filterBtnText}>Apply Filter</Text>
          </TouchableOpacity>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      }
      renderItem={({ item }) => <RecommendationCard item={item} />}
      ListEmptyComponent={<Text style={styles.empty}>No recommendations found.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  content: { padding: 14, paddingBottom: 30, backgroundColor: '#f8fafc', minHeight: '100%' },
  filterCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  filterTitle: { color: '#0f172a', fontWeight: '800', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  filterBtn: { backgroundColor: '#0f766e', borderRadius: 8, alignItems: 'center', paddingVertical: 9 },
  filterBtnText: { color: '#fff', fontWeight: '700' },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  name: { color: '#0f172a', fontWeight: '800' },
  meta: { color: '#475569', marginTop: 4 },
  reasons: { color: '#64748b', marginTop: 6 },
  error: { marginTop: 8, color: '#b91c1c' },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 20 },
});
