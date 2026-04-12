import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import {
  dashboardAnalyticsRequest,
  extractErrorMessage,
  gamificationLeaderboardRequest,
  gamificationUserRequest,
} from '../api/client';

export default function InsightsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState(null);
  const [gamification, setGamification] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);

  const loadData = useCallback(async ({ silent } = { silent: false }) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [dashboardRes, gamificationRes, leaderboardRes] = await Promise.all([
        dashboardAnalyticsRequest(30),
        gamificationUserRequest(),
        gamificationLeaderboardRequest(),
      ]);

      setOverview(dashboardRes?.data?.overview || null);
      setGamification(gamificationRes?.data || null);
      setLeaderboard(Array.isArray(leaderboardRes?.data?.leaderboard) ? leaderboardRes.data.leaderboard.slice(0, 10) : []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not load insights'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
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
      data={leaderboard}
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
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Analytics Overview (30d)</Text>
            <Text style={styles.row}>Posts: {overview?.totalPosts || 0}</Text>
            <Text style={styles.row}>Followers: {overview?.totalFollowers || 0}</Text>
            <Text style={styles.row}>Following: {overview?.totalFollowing || 0}</Text>
            <Text style={styles.row}>Likes: {overview?.totalLikes || 0}</Text>
            <Text style={styles.row}>Comments: {overview?.totalComments || 0}</Text>
            <Text style={styles.row}>Profile Views: {overview?.profileViews || 0}</Text>
            <Text style={styles.row}>Engagement Rate: {overview?.engagementRate || 0}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Gamification</Text>
            <Text style={styles.row}>Level: {gamification?.user?.level || 1}</Text>
            <Text style={styles.row}>Points: {gamification?.user?.points || 0}</Text>
            <Text style={styles.row}>Achievements: {Array.isArray(gamification?.achievements) ? gamification.achievements.filter((a) => a.unlocked).length : 0}</Text>
            <Text style={styles.row}>Badges: {Array.isArray(gamification?.badges) ? gamification.badges.filter((b) => b.earned).length : 0}</Text>
          </View>

          <Text style={styles.sectionTitle}>Top Leaderboard</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.rankCard}>
          <Text style={styles.rankName}>#{item?.rank || '-'} {item?.firstName || ''} {item?.lastName || ''}</Text>
          <Text style={styles.rankMeta}>Level {item?.level || 1} | {item?.points || 0} pts</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>No leaderboard data.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  content: { padding: 14, paddingBottom: 30, backgroundColor: '#f8fafc', minHeight: '100%' },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  cardTitle: { color: '#0f172a', fontWeight: '800', marginBottom: 8 },
  row: { color: '#334155', marginBottom: 6 },
  sectionTitle: { color: '#334155', fontWeight: '800', marginBottom: 8 },
  rankCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  rankName: { color: '#0f172a', fontWeight: '700' },
  rankMeta: { color: '#475569', marginTop: 4 },
  error: { color: '#b91c1c', marginBottom: 10 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 20 },
});
