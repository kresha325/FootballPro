import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Dimensions,
  FlatList,
  Image,
} from 'react-native';
import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import * as Progress from 'react-native-progress';
import { gamificationAPI } from '../api/client';

const { width } = Dimensions.get('window');

const GamificationScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [gamificationData, setGamificationData] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const prevLevel = useRef(null);

  const fetchData = async () => {
    try {
      const [gamifRes, leaderboardRes] = await Promise.all([
        gamificationAPI.getUserStatus(),
        gamificationAPI.getLeaderboard(),
      ]);
      setGamificationData(gamifRes.data);
      setLeaderboard(leaderboardRes.data.leaderboard || leaderboardRes.data);
    } catch (error) {
      console.error('Failed to fetch gamification data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'legendary': return '#FFD700';
      case 'epic': return '#DA70D6';
      case 'rare': return '#40E0D0';
      case 'uncommon': return '#90EE90';
      default: return '#A9A9A9';
    }
  };

  const getRarityIcon = (rarity) => {
    switch (rarity) {
      case 'legendary': return '👑';
      case 'epic': return '⭐';
      case 'rare': return '✨';
      case 'uncommon': return '⭐';
      default: return '•';
    }
  };

  const profileUser = gamificationData?.user;
  const userAchievements = gamificationData?.achievements || [];
  const userBadges = gamificationData?.badges || [];
  const stats = gamificationData?.stats || {};

  const xpProgress = profileUser?.points ? ((profileUser.points % 1000) / 1000) : 0;
  const xpCurrent = profileUser?.points ? (profileUser.points % 1000) : 0;
  const nextLevelXp = 1000;

  const unlockedAchievements = userAchievements.filter(a => a.unlocked);
  const lockedAchievements = userAchievements.filter(a => !a.unlocked);

  const unlockedBadges = userBadges.filter(b => b.earned);
  const lockedBadges = userBadges.filter(b => !b.earned);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER - XP Progress */}
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Level & XP Card */}
        <View style={styles.levelCard}>
          <View style={styles.levelHeader}>
            <View>
              <Text style={styles.levelLabel}>LEVEL</Text>
              <Text style={styles.levelNumber}>{profileUser?.level || 1}</Text>
            </View>
            <MaterialCommunityIcons name="trophy" size={48} color="#FFD700" />
            <View style={styles.alignRight}>
              <Text style={styles.xpLabel}>XP TO NEXT</Text>
              <Text style={styles.xpNumber}>{nextLevelXp - xpCurrent}</Text>
            </View>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressBar}>
              <Progress.Bar
                progress={xpProgress}
                width={width - 40}
                height={12}
                color="#2563eb"
                unfilledColor="#E5E7EB"
                borderWidth={0}
              />
            </View>
            <View style={styles.progressText}>
              <Text style={styles.xpCurrent}>{xpCurrent} XP</Text>
              <Text style={styles.xpMax}>{nextLevelXp} XP</Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>📝</Text>
              <Text style={styles.statValue}>{stats.posts || 0}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>👥</Text>
              <Text style={styles.statValue}>{stats.followers || 0}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>👍</Text>
              <Text style={styles.statValue}>{stats.likes || 0}</Text>
              <Text style={styles.statLabel}>Likes</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>⚽</Text>
              <Text style={styles.statValue}>{stats.matches || 0}</Text>
              <Text style={styles.statLabel}>Matches</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>⚽</Text>
              <Text style={styles.statValue}>{stats.goals || 0}</Text>
              <Text style={styles.statLabel}>Goals</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>🎯</Text>
              <Text style={styles.statValue}>{stats.assists || 0}</Text>
              <Text style={styles.statLabel}>Assists</Text>
            </View>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          {['overview', 'achievements', 'badges', 'leaderboard'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <View style={styles.tabContent}>
            {/* Quick Stats */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📊 Quick Stats</Text>
              <View style={styles.statCard}>
                <View style={styles.statRow}>
                  <Text style={styles.statRowLabel}>Win Streak</Text>
                  <Text style={styles.statRowValue}>{stats.winStreak || 0} 🔥</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statRowLabel}>Clean Sheets</Text>
                  <Text style={styles.statRowValue}>{stats.cleanSheet || 0} 🛡️</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statRowLabel}>Comments</Text>
                  <Text style={styles.statRowValue}>{stats.comments || 0} 💬</Text>
                </View>
              </View>
            </View>

            {/* Recent Unlocks */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🎉 Recent Achievements</Text>
              {unlockedAchievements.slice(0, 3).length > 0 ? (
                unlockedAchievements.slice(0, 3).map((achievement) => (
                  <View key={achievement.id} style={styles.achievementRow}>
                    <Text style={styles.achievementIcon}>{achievement.icon || '🏆'}</Text>
                    <View style={styles.achievementInfo}>
                      <Text style={styles.achievementName}>{achievement.name}</Text>
                      <Text style={styles.achievementDesc} numberOfLines={1}>
                        {achievement.description}
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="check-circle" size={24} color="#10b981" />
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>Keep playing to unlock achievements!</Text>
              )}
            </View>
          </View>
        )}

        {/* ACHIEVEMENTS TAB */}
        {activeTab === 'achievements' && (
          <View style={styles.tabContent}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>🏆 Achievements</Text>
                <Text style={styles.badgeCount}>
                  {unlockedAchievements.length}/{userAchievements.length}
                </Text>
              </View>

              {/* Unlocked */}
              {unlockedAchievements.length > 0 && (
                <>
                  <Text style={styles.subSectionTitle}>Unlocked</Text>
                  {unlockedAchievements.map((achievement) => (
                    <View key={achievement.id} style={styles.achievementItem}>
                      <View style={styles.achievementItemContent}>
                        <Text style={styles.achievementIcon}>{achievement.icon || '🏆'}</Text>
                        <View style={styles.achievementItemText}>
                          <Text style={styles.achievementName}>{achievement.name}</Text>
                          <Text style={styles.achievementDesc} numberOfLines={2}>
                            {achievement.description}
                          </Text>
                        </View>
                      </View>
                      <MaterialCommunityIcons name="check-circle" size={20} color="#10b981" />
                    </View>
                  ))}
                </>
              )}

              {/* Locked */}
              {lockedAchievements.length > 0 && (
                <>
                  <Text style={[styles.subSectionTitle, { marginTop: 20 }]}>Locked</Text>
                  {lockedAchievements.map((achievement) => (
                    <View key={achievement.id} style={[styles.achievementItem, styles.lockedItem]}>
                      <View style={styles.achievementItemContent}>
                        <Text style={styles.achievementIcon}>🔒</Text>
                        <View style={styles.achievementItemText}>
                          <Text style={styles.achievementName}>{achievement.name}</Text>
                          <View style={styles.progressContainer}>
                            <Progress.Bar
                              progress={achievement.progress ? achievement.progress / 100 : 0}
                              width={width - 120}
                              height={6}
                              color="#3b82f6"
                              unfilledColor="#E5E7EB"
                              borderWidth={0}
                            />
                            <Text style={styles.progressPercent}>{achievement.progress || 0}%</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </View>
          </View>
        )}

        {/* BADGES TAB */}
        {activeTab === 'badges' && (
          <View style={styles.tabContent}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>🎖️ Badges</Text>
                <Text style={styles.badgeCount}>
                  {unlockedBadges.length}/{userBadges.length}
                </Text>
              </View>

              {/* Unlocked Badges Grid */}
              {unlockedBadges.length > 0 && (
                <>
                  <Text style={styles.subSectionTitle}>Earned</Text>
                  <View style={styles.badgeGrid}>
                    {unlockedBadges.map((badge) => (
                      <TouchableOpacity
                        key={badge.id}
                        style={[
                          styles.badgeItem,
                          { borderColor: getRarityColor(badge.rarity) },
                        ]}
                      >
                        <Text style={styles.badgeIcon}>{badge.icon || '🏅'}</Text>
                        <Text style={styles.badgeName}>{badge.name}</Text>
                        <Text style={[styles.rarityBadge, { color: getRarityColor(badge.rarity) }]}>
                          {badge.rarity}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Locked Badges Grid */}
              {lockedBadges.length > 0 && (
                <>
                  <Text style={[styles.subSectionTitle, { marginTop: 20 }]}>Locked</Text>
                  <View style={styles.badgeGrid}>
                    {lockedBadges.map((badge) => (
                      <View
                        key={badge.id}
                        style={[styles.badgeItem, styles.lockedBadge]}
                      >
                        <Text style={styles.lockedBadgeIcon}>🔒</Text>
                        <Text style={styles.badgeName}>{badge.name}</Text>
                        <Text style={[styles.rarityBadge, { color: '#9CA3AF' }]}>
                          {badge.rarity}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {/* LEADERBOARD TAB */}
        {activeTab === 'leaderboard' && (
          <View style={styles.tabContent}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🏁 Global Leaderboard</Text>
              {leaderboard && leaderboard.length > 0 ? (
                leaderboard.slice(0, 20).map((player, index) => (
                  <View key={index} style={styles.leaderboardRow}>
                    <View style={styles.rankContainer}>
                      {index === 0 && <Text style={styles.rankEmoji}>🥇</Text>}
                      {index === 1 && <Text style={styles.rankEmoji}>🥈</Text>}
                      {index === 2 && <Text style={styles.rankEmoji}>🥉</Text>}
                      {index > 2 && <Text style={styles.rank}>#{index + 1}</Text>}
                    </View>
                    <View style={styles.playerInfo}>
                      <Text style={styles.playerName}>{player.firstName} {player.lastName}</Text>
                      <Text style={styles.playerLevel}>Level {player.level}</Text>
                    </View>
                    <View style={styles.playerStats}>
                      <Text style={styles.playerXP}>{player.points} XP</Text>
                      <Text style={styles.playerBadges}>{player.badgeCount || 0} 🎖️</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No leaderboard data available</Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelCard: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  levelLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  levelNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 4,
  },
  alignRight: {
    alignItems: 'flex-end',
  },
  xpLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  xpNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 4,
  },
  progressSection: {
    marginBottom: 20,
  },
  progressBar: {
    marginBottom: 8,
  },
  progressText: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  xpCurrent: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  xpMax: {
    fontSize: 14,
    color: '#6B7280',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginBottom: 8,
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#2563eb',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#2563eb',
  },
  tabContent: {
    paddingBottom: 20,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
  },
  badgeCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  statCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  statRowLabel: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  statRowValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  achievementIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  achievementDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  achievementItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  achievementItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  achievementItemText: {
    flex: 1,
    marginLeft: 12,
  },
  lockedItem: {
    opacity: 0.6,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  progressPercent: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 8,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 20,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  badgeItem: {
    width: '30%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  badgeIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  badgeName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
  },
  rarityBadge: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  lockedBadge: {
    opacity: 0.5,
  },
  lockedBadgeIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  rankContainer: {
    width: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankEmoji: {
    fontSize: 24,
  },
  rank: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  playerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  playerLevel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  playerStats: {
    alignItems: 'flex-end',
  },
  playerXP: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  playerBadges: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
});

export default GamificationScreen;
