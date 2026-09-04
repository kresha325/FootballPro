import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  Text,
  View,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { VictoryBar, VictoryLine, VictoryChart, VictoryAxis, VictoryTheme } from 'victory-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  dashboardAnalyticsRequest,
  extractErrorMessage,
  gamificationLeaderboardRequest,
  gamificationUserRequest,
} from '../api/client';

const { width } = Dimensions.get('window');

function InsightsSkeleton() {
  return (
    <View style={styles.content}>
      <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
      {[1, 2, 3].map((i) => (
        <View key={`i-${i}`} style={[styles.card, styles.skeletonBlock]} />
      ))}
    </View>
  );
}

// Use stable overview-based fallback data until historical series are available.
const generateChartData = (overview) => {
  if (!overview) return [];
  const days = 30;
  const baseFollowers = Math.max(1, overview?.totalFollowers || 0);
  return Array.from({ length: days }, (_, i) => ({
      x: i + 1,
      y: baseFollowers,
      day: `Day ${i + 1}`,
    }));
};

const generatePostsData = (overview) => {
  if (!overview) return [];
  const days = 30;
  const totalPosts = Math.max(1, overview?.totalPosts || 0);
  const dailyPosts = Math.floor(totalPosts / days);
  const remainder = totalPosts % days;
  return Array.from({ length: days }, (_, i) => ({
      x: i + 1,
      y: dailyPosts + (i < remainder ? 1 : 0),
      day: `Day ${i + 1}`,
    }));
};

const generateEngagementData = (overview) => {
  if (!overview) return [];
  const days = 30;
  const totalEngagement = (overview?.totalLikes || 0) + (overview?.totalComments || 0);
  const dailyEngagement = Math.floor(totalEngagement / days);
  const remainder = totalEngagement % days;
  return Array.from({ length: days }, (_, i) => ({
      x: i + 1,
      y: dailyEngagement + (i < remainder ? 1 : 0),
      day: `Day ${i + 1}`,
    }));
};

export default function InsightsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState(null);
  const [gamification, setGamification] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

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
      setLeaderboard(
        Array.isArray(leaderboardRes?.data?.leaderboard)
          ? leaderboardRes.data.leaderboard.slice(0, 10)
          : []
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

  if (loading) {
    return <InsightsSkeleton />;
  }

  const engagementData = generateChartData(overview);
  const postsData = generatePostsData(overview);
  const engagementEngData = generateEngagementData(overview);

  const unlockedAchievements = Array.isArray(gamification?.achievements)
    ? gamification.achievements.filter((a) => a.unlocked).length
    : 0;

  const unlockedBadges = Array.isArray(gamification?.badges)
    ? gamification.badges.filter((b) => b.earned).length
    : 0;

  return (
    <View style={styles.container}>
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {['overview', 'engagement', 'followers', 'leaderboard'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab }}
            accessibilityLabel={`${tab} tab`}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'overview'
                ? '📊'
                : tab === 'engagement'
                ? '💬'
                : tab === 'followers'
                ? '👥'
                : '🏆'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData({ silent: true });
            }}
            colors={['#2563eb']}
          />
        }
        contentContainerStyle={styles.content}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <>
            {/* Quick Stats */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <MaterialCommunityIcons name="file-document" size={24} color="#2563eb" />
                <Text style={styles.statValue}>{overview?.totalPosts || 0}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
              <View style={styles.statCard}>
                <MaterialCommunityIcons name="heart" size={24} color="#ef4444" />
                <Text style={styles.statValue}>{overview?.totalLikes || 0}</Text>
                <Text style={styles.statLabel}>Likes</Text>
              </View>
              <View style={styles.statCard}>
                <MaterialCommunityIcons name="comment" size={24} color="#10b981" />
                <Text style={styles.statValue}>{overview?.totalComments || 0}</Text>
                <Text style={styles.statLabel}>Comments</Text>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <MaterialCommunityIcons name="eye" size={24} color="#f59e0b" />
                <Text style={styles.statValue}>{overview?.profileViews || 0}</Text>
                <Text style={styles.statLabel}>Views</Text>
              </View>
              <View style={styles.statCard}>
                <MaterialCommunityIcons name="account-multiple" size={24} color="#6366f1" />
                <Text style={styles.statValue}>{overview?.totalFollowers || 0}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statCard}>
                <MaterialCommunityIcons name="percent" size={24} color="#8b5cf6" />
                <Text style={styles.statValue}>
                  {(overview?.engagementRate || 0).toFixed(1)}%
                </Text>
                <Text style={styles.statLabel}>Engagement</Text>
              </View>
            </View>

            {/* Gamification Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🎮 Gamification Stats</Text>
              <View style={styles.gamificationGrid}>
                <View style={styles.gamificationItem}>
                  <Text style={styles.gamificationIcon}>⭐</Text>
                  <Text style={styles.gamificationValue}>
                    {gamification?.user?.level || 1}
                  </Text>
                  <Text style={styles.gamificationLabel}>Level</Text>
                </View>
                <View style={styles.gamificationItem}>
                  <Text style={styles.gamificationIcon}>🎯</Text>
                  <Text style={styles.gamificationValue}>
                    {gamification?.user?.points || 0}
                  </Text>
                  <Text style={styles.gamificationLabel}>Points</Text>
                </View>
                <View style={styles.gamificationItem}>
                  <Text style={styles.gamificationIcon}>🏆</Text>
                  <Text style={styles.gamificationValue}>{unlockedAchievements}</Text>
                  <Text style={styles.gamificationLabel}>Achievements</Text>
                </View>
                <View style={styles.gamificationItem}>
                  <Text style={styles.gamificationIcon}>🎖️</Text>
                  <Text style={styles.gamificationValue}>{unlockedBadges}</Text>
                  <Text style={styles.gamificationLabel}>Badges</Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* ENGAGEMENT TAB */}
        {activeTab === 'engagement' && engagementEngData.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>💬 Engagement Over Time</Text>
            <View style={styles.chartContainer}>
              <VictoryChart theme={VictoryTheme.material} width={width - 32} height={300}>
                <VictoryAxis
                  style={{
                    axis: { stroke: '#e5e7eb' },
                    ticks: { stroke: '#e5e7eb' },
                    tickLabels: { fontSize: 10, fill: '#6b7280' },
                  }}
                />
                <VictoryAxis
                  dependentAxis
                  style={{
                    axis: { stroke: '#e5e7eb' },
                    ticks: { stroke: '#e5e7eb' },
                    tickLabels: { fontSize: 10, fill: '#6b7280' },
                  }}
                />
                <VictoryLine
                  data={engagementEngData}
                  style={{ data: { stroke: '#10b981', strokeWidth: 2 } }}
                />
              </VictoryChart>
            </View>
            <Text style={styles.chartNote}>
              Total Engagement: {overview?.totalLikes || 0} likes + {overview?.totalComments || 0}{' '}
              comments
            </Text>
          </View>
        )}

        {/* FOLLOWERS TAB */}
        {activeTab === 'followers' && engagementData.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>👥 Follower Growth</Text>
            <View style={styles.chartContainer}>
              <VictoryChart theme={VictoryTheme.material} width={width - 32} height={300}>
                <VictoryAxis
                  style={{
                    axis: { stroke: '#e5e7eb' },
                    ticks: { stroke: '#e5e7eb' },
                    tickLabels: { fontSize: 10, fill: '#6b7280' },
                  }}
                />
                <VictoryAxis
                  dependentAxis
                  style={{
                    axis: { stroke: '#e5e7eb' },
                    ticks: { stroke: '#e5e7eb' },
                    tickLabels: { fontSize: 10, fill: '#6b7280' },
                  }}
                />
                <VictoryBar data={engagementData} style={{ data: { fill: '#6366f1' } }} />
              </VictoryChart>
            </View>
            <Text style={styles.chartNote}>
              Current Followers: {overview?.totalFollowers || 0}
            </Text>
          </View>
        )}

        {/* LEADERBOARD TAB */}
        {activeTab === 'leaderboard' && (
          <>
            <Text style={styles.sectionTitle}>🏆 Top Players (Leaderboard)</Text>
            {leaderboard && leaderboard.length > 0 ? (
              leaderboard.map((item, index) => (
                <View key={index} style={styles.rankCard}>
                  <View style={styles.rankBadge}>
                    {index === 0 && <Text style={styles.rankEmoji}>🥇</Text>}
                    {index === 1 && <Text style={styles.rankEmoji}>🥈</Text>}
                    {index === 2 && <Text style={styles.rankEmoji}>🥉</Text>}
                    {index > 2 && <Text style={styles.rankNumber}>#{index + 1}</Text>}
                  </View>
                  <View style={styles.rankName}>
                    <Text style={styles.rankTitle}>
                      {item?.firstName || ''} {item?.lastName || ''}
                    </Text>
                    <Text style={styles.rankMeta}>Level {item?.level || 1}</Text>
                  </View>
                  <Text style={styles.rankPoints}>{item?.points || 0} XP</Text>
                </View>
              ))
            ) : (
              <Text style={styles.empty}>No leaderboard data.</Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 3,
    borderBottomColor: '#2563eb',
  },
  tabText: {
    fontSize: 18,
    color: '#cbd5e1',
  },
  tabTextActive: {
    color: '#2563eb',
  },
  content: {
    padding: 16,
    paddingBottom: 30,
  },
  error: {
    color: '#dc2626',
    marginBottom: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 6,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 16,
    marginBottom: 12,
  },
  gamificationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gamificationItem: {
    width: '48%',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  gamificationIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  gamificationValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  gamificationLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  chartContainer: {
    marginVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartNote: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  sectionTitle: {
    color: '#334155',
    fontWeight: '800',
    fontSize: 16,
    marginBottom: 12,
  },
  rankCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rankBadge: {
    width: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankEmoji: {
    fontSize: 24,
  },
  rankNumber: {
    color: '#64748b',
    fontWeight: '700',
    fontSize: 14,
  },
  rankName: {
    flex: 1,
    marginLeft: 12,
  },
  rankTitle: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 14,
  },
  rankMeta: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  rankPoints: {
    color: '#2563eb',
    fontWeight: 'bold',
    fontSize: 12,
  },
  empty: {
    textAlign: 'center',
    color: '#94a3b8',
    marginTop: 20,
  },
  skeletonBlock: {
    height: 90,
    backgroundColor: '#e2e8f0',
  },
});
