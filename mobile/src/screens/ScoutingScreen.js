import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { aiScoutSummaryRequest, extractErrorMessage, scoutingRecommendationsRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';

const PAGE_SIZE = 10;
const SCOUT_AI_ROLES = new Set(['scout', 'club', 'coach', 'manager', 'trajner']);

function RecommendationCard({ item, onAiSummary, aiLoadingId }) {
  const playerId = item?.playerId;
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{item?.playerName || 'Player'}</Text>
      <Text style={styles.meta}>Position: {item?.position || 'N/A'} | Club: {item?.club || 'N/A'}</Text>
      <Text style={styles.meta}>Score: {item?.score || 0} ({item?.percentage || 0}%)</Text>
      <Text style={styles.reasons}>Reasons: {Array.isArray(item?.reasons) ? item.reasons.slice(0, 3).join(' | ') : 'N/A'}</Text>
      {onAiSummary && playerId ? (
        <TouchableOpacity
          style={styles.aiBtn}
          disabled={aiLoadingId === playerId}
          onPress={() => onAiSummary(playerId, item?.playerName)}
        >
          {aiLoadingId === playerId ? (
            <ActivityIndicator size="small" color="#0f766e" />
          ) : (
            <Text style={styles.aiBtnText}>Përmbledhje AI</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function ScoutingScreen() {
  const { user } = useAuth();
  const canUseScouting = user?.role === 'scout' || user?.role === 'club';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [position, setPosition] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [aiLoadingId, setAiLoadingId] = useState(null);
  const canUseAi = SCOUT_AI_ROLES.has(String(user?.role || '').toLowerCase());

  const fetchAiSummary = async (playerId, playerName) => {
    setAiLoadingId(playerId);
    try {
      const res = await aiScoutSummaryRequest(playerId);
      const summary = res.data?.summary || '';
      Alert.alert(`AI — ${playerName || 'Lojtari'}`, summary || 'Nuk u gjenerua përmbledhje.');
    } catch (err) {
      Alert.alert('AI', extractErrorMessage(err, 'Përmbledhja dështoi'));
    } finally {
      setAiLoadingId(null);
    }
  };

  const loadData = useCallback(async ({ silent, customPosition } = { silent: false, customPosition: '' }) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await scoutingRecommendationsRequest({
        position: customPosition !== undefined ? customPosition : position,
        limit: 20,
      });
      setRecommendations(Array.isArray(res?.data?.recommendations) ? res.data.recommendations : []);
      setVisibleCount(PAGE_SIZE);
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not load scouting recommendations'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [position]);

  useEffect(() => {
    if (!canUseScouting) {
      setLoading(false);
      return;
    }
    loadData({ customPosition: '' });
  }, [canUseScouting, loadData]);

  if (!canUseScouting) {
    return (
      <View style={styles.centered}>
        <Text style={styles.accessTitle}>Scouting access is restricted</Text>
        <Text style={styles.accessText}>Only users with scout or club role can use scouting recommendations.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <FlatList
      data={recommendations.slice(0, visibleCount)}
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
      renderItem={({ item }) => (
        <RecommendationCard
          item={item}
          onAiSummary={canUseAi ? fetchAiSummary : null}
          aiLoadingId={aiLoadingId}
        />
      )}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (visibleCount < recommendations.length) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, recommendations.length));
        }
      }}
      ListFooterComponent={
        visibleCount < recommendations.length ? <Text style={styles.footerText}>Loading more...</Text> : null
      }
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
  aiBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#0f766e',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  aiBtnText: { color: '#0f766e', fontWeight: '700', fontSize: 13 },
  error: { marginTop: 8, color: '#b91c1c' },
  footerText: { textAlign: 'center', color: '#64748b', marginVertical: 10 },
  accessTitle: { color: '#0f172a', fontWeight: '800', fontSize: 18, textAlign: 'center' },
  accessText: { color: '#475569', marginTop: 8, textAlign: 'center' },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 20 },
});
