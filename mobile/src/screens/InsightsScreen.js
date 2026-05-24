import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import {
  dashboardAnalyticsRequest,
  engagementRateAnalyticsRequest,
  extractErrorMessage,
  followerGrowthAnalyticsRequest,
  gamificationAchievementsRequest,
  gamificationBadgesRequest,
  gamificationLeaderboardRequest,
  gamificationUserRequest,
} from '../api/client';

function InsightsSkeleton() {
  return (
    <View style={styles.content}>
      {[1, 2, 3].map((i) => (
        <View key={`i-${i}`} style={[styles.card, styles.skeletonBlock]} />
      ))}
    </View>
  );
}

export default function InsightsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState(null);
  const [followerGrowth, setFollowerGrowth] = useState(null);
  const [engagement, setEngagement] = useState(null);
  const [gamification, setGamification] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [badges, setBadges] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);

  const loadData = useCallback(async ({ silent } = { silent: false }) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [
        dashboardRes,
        growthRes,
        engagementRes,
        gamificationRes,
        achievementsRes,
        badgesRes,
        leaderboardRes,
      ] = await Promise.all([
        dashboardAnalyticsRequest(30),
        followerGrowthAnalyticsRequest(30).catch(() => ({ data: null })),
        engagementRateAnalyticsRequest(30).catch(() => ({ data: null })),
        gamificationUserRequest(),
        gamificationAchievementsRequest().catch(() => ({ data: [] })),
        gamificationBadgesRequest().catch(() => ({ data: [] })),
        gamificationLeaderboardRequest().catch(() => ({ data: { leaderboard: [] } })),
      ]);

      setOverview(dashboardRes?.data?.overview || null);
      setFollowerGrowth(growthRes?.data || null);
      setEngagement(engagementRes?.data || null);
      setGamification(gamificationRes?.data || null);
      setAchievements(Array.isArray(achievementsRes?.data) ? achievementsRes.data : []);
      setBadges(Array.isArray(badgesRes?.data) ? badgesRes.data : []);
      setLeaderboard(
        Array.isArray(leaderboardRes?.data?.leaderboard) ? leaderboardRes.data.leaderboard.slice(0, 10) : []
      );
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

  const unlockedAchievements = achievements.filter((a) => a.unlocked);
  const earnedBadges = badges.filter((b) => b.earned);

  if (loading) {
    return <InsightsSkeleton />;
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
            <Text style={styles.cardTitle}>Analytics (30 days)</Text>
            <Text style={styles.row}>Posts: {overview?.totalPosts || 0}</Text>
            <Text style={styles.row}>Followers: {overview?.totalFollowers || 0}</Text>
            <Text style={styles.row}>Following: {overview?.totalFollowing || 0}</Text>
            <Text style={styles.row}>Likes: {overview?.totalLikes || 0}</Text>
            <Text style={styles.row}>Comments: {overview?.totalComments || 0}</Text>
            <Text style={styles.row}>Profile views: {overview?.profileViews || 0}</Text>
            <Text style={styles.row}>Engagement rate: {overview?.engagementRate || 0}%</Text>
          </View>

          {followerGrowth ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Follower growth</Text>
              <Text style={styles.row}>New followers: {followerGrowth?.newFollowers ?? followerGrowth?.total ?? '—'}</Text>
              <Text style={styles.row}>Growth rate: {followerGrowth?.growthRate ?? '—'}</Text>
            </View>
          ) : null}

          {engagement ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Engagement</Text>
              <Text style={styles.row}>Rate: {engagement?.engagementRate ?? engagement?.rate ?? '—'}</Text>
              <Text style={styles.row}>Interactions: {engagement?.totalInteractions ?? '—'}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Gamification</Text>
            <Text style={styles.row}>Level: {gamification?.user?.level || 1}</Text>
            <Text style={styles.row}>Points: {gamification?.user?.points || 0}</Text>
            <Text style={styles.row}>
              Achievements: {unlockedAchievements.length}/{achievements.length || unlockedAchievements.length}
            </Text>
            <Text style={styles.row}>
              Badges: {earnedBadges.length}/{badges.length || earnedBadges.length}
            </Text>
          </View>

          {unlockedAchievements.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Recent achievements</Text>
              {unlockedAchievements.slice(0, 5).map((a) => (
                <Text key={String(a.id || a.key)} style={styles.row}>
                  ✓ {a.name || a.title || a.key}
                </Text>
              ))}
            </View>
          ) : null}

          {earnedBadges.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Badges earned</Text>
              {earnedBadges.slice(0, 8).map((b) => (
                <Text key={String(b.id || b.name)} style={styles.row}>
                  🏅 {b.name || b.title}
                </Text>
              ))}
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>Leaderboard</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.rankCard}>
          <Text style={styles.rankName}>
            #{item?.rank || '-'} {item?.firstName || ''} {item?.lastName || ''}
          </Text>
          <Text style={styles.rankMeta}>
            Level {item?.level || 1} | {item?.points || 0} pts
          </Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>No leaderboard data.</Text>}
    />
  );
}

const styles = StyleSheet.create({
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
  skeletonBlock: { height: 90, backgroundColor: '#e2e8f0' },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 20 },
});
