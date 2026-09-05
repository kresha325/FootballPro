import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import { absoluteBackendUrl } from '../config/constants';

const PERIODS = [
  { key: 7, label: '7 ditë' },
  { key: 30, label: '30 ditë' },
  { key: 90, label: '90 ditë' },
];

function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
}

function rarityTone(rarity) {
  switch ((rarity || '').toLowerCase()) {
    case 'legendary':
      return { border: '#F59E0B', bg: '#FFFBEB', label: '#B45309' };
    case 'epic':
      return { border: '#0F766E', bg: '#F0FDFA', label: '#0F766E' };
    case 'rare':
      return { border: '#3B82F6', bg: '#EFF6FF', label: '#1D4ED8' };
    default:
      return { border: '#E2E8F0', bg: '#F8FAFC', label: '#64748B' };
  }
}

function StatTile({ icon, label, value, tone }) {
  return (
    <View style={styles.statTile}>
      <View style={[styles.statIconWrap, { backgroundColor: tone }]}>
        <Ionicons name={icon} size={18} color="#FFFFFF" />
      </View>
      <Text style={styles.statValue}>{formatNumber(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MiniBars({ series }) {
  const points = Array.isArray(series) ? series.slice(-10) : [];
  if (points.length < 2) {
    return <Text style={styles.muted}>Nuk ka të dhëna për këtë periudhë.</Text>;
  }
  const max = Math.max(...points.map((p) => Number(p.count || p.rate || p.value || 0)), 1);
  return (
    <View style={styles.barsRow}>
      {points.map((p, idx) => {
        const raw = Number(p.count || p.rate || p.value || 0);
        const h = Math.max(6, Math.round((raw / max) * 72));
        return (
          <View key={`${p.date || idx}`} style={styles.barCol}>
            <View style={[styles.bar, { height: h }]} />
          </View>
        );
      })}
    </View>
  );
}

function ProgressBar({ progress, color = '#F59E0B' }) {
  const pct = Math.max(0, Math.min(100, Number(progress) || 0));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

function SegmentTabs({ value, onChange }) {
  return (
    <View style={styles.segment}>
      {[
        { key: 'analytics', label: 'Analitika', icon: 'stats-chart-outline' },
        { key: 'gamification', label: 'Gamifikim', icon: 'trophy-outline' },
      ].map((tab) => {
        const active = value === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.segmentBtn, active && styles.segmentBtnActive]}
            onPress={() => onChange(tab.key)}
            activeOpacity={0.85}
          >
            <Ionicons name={tab.icon} size={16} color={active ? '#0F172A' : '#64748B'} />
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function InsightsScreen() {
  const [tab, setTab] = useState('analytics');
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState(null);
  const [topPosts, setTopPosts] = useState([]);
  const [postType, setPostType] = useState(null);
  const [followerGrowth, setFollowerGrowth] = useState([]);
  const [engagementSeries, setEngagementSeries] = useState([]);
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
        dashboardAnalyticsRequest(period),
        followerGrowthAnalyticsRequest(period).catch(() => ({ data: [] })),
        engagementRateAnalyticsRequest(period).catch(() => ({ data: [] })),
        gamificationUserRequest().catch(() => ({ data: null })),
        gamificationAchievementsRequest().catch(() => ({ data: [] })),
        gamificationBadgesRequest().catch(() => ({ data: [] })),
        gamificationLeaderboardRequest().catch(() => ({ data: { leaderboard: [] } })),
      ]);

      const dash = dashboardRes?.data || {};
      setOverview(dash.overview || null);
      setTopPosts(Array.isArray(dash.topPosts) ? dash.topPosts.slice(0, 3) : []);
      setPostType(dash.postTypePerformance || null);

      const growth = growthRes?.data;
      setFollowerGrowth(Array.isArray(growth) ? growth : []);
      const eng = engagementRes?.data;
      setEngagementSeries(Array.isArray(eng) ? eng : []);

      const gamif = gamificationRes?.data || null;
      setGamification(gamif);

      const achFromUser = Array.isArray(gamif?.achievements) ? gamif.achievements : null;
      const badgeFromUser = Array.isArray(gamif?.badges) ? gamif.badges : null;
      setAchievements(
        achFromUser || (Array.isArray(achievementsRes?.data) ? achievementsRes.data : [])
      );
      setBadges(badgeFromUser || (Array.isArray(badgesRes?.data) ? badgesRes.data : []));

      const board = leaderboardRes?.data?.leaderboard || leaderboardRes?.data;
      setLeaderboard(Array.isArray(board) ? board.slice(0, 10) : []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Nuk u ngarkuan insights'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const gUser = gamification?.user || {};
  const points = Number(gUser.points || gUser.xp || 0);
  const level = Number(gUser.level || 1);
  const xpInLevel = points % 1000;
  const xpProgress = Math.min(100, Math.round((xpInLevel / 1000) * 100));

  const unlockedAchievements = useMemo(
    () => achievements.filter((a) => a.unlocked),
    [achievements]
  );
  const lockedAchievements = useMemo(
    () => achievements.filter((a) => !a.unlocked),
    [achievements]
  );
  const earnedBadges = useMemo(() => badges.filter((b) => b.earned), [badges]);

  const newFollowers = useMemo(() => {
    if (!followerGrowth.length) return 0;
    const first = Number(followerGrowth[0]?.count || 0);
    const last = Number(followerGrowth[followerGrowth.length - 1]?.count || 0);
    return Math.max(0, last - first);
  }, [followerGrowth]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#0F766E" />
        <Text style={styles.loadingText}>Duke ngarkuar insights…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadData({ silent: true });
          }}
          colors={['#0F766E']}
          tintColor="#0F766E"
        />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>Performanca jote</Text>
        <Text style={styles.heroTitle}>Insights</Text>
        <Text style={styles.heroSub}>Analitika e profilit dhe progresi XP në një vend.</Text>
        <SegmentTabs value={tab} onChange={setTab} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {tab === 'analytics' ? (
        <View>
          <View style={styles.periodRow}>
            {PERIODS.map((p) => (
              <TouchableOpacity
                key={p.key}
                style={[styles.periodChip, period === p.key && styles.periodChipActive]}
                onPress={() => setPeriod(p.key)}
              >
                <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.statGrid}>
            <StatTile icon="people" label="Ndjekës" value={overview?.totalFollowers} tone="#0F766E" />
            <StatTile icon="heart" label="Pëlqime" value={overview?.totalLikes} tone="#DC2626" />
            <StatTile icon="chatbubble" label="Komente" value={overview?.totalComments} tone="#F59E0B" />
            <StatTile icon="eye" label="Shikime" value={overview?.profileViews} tone="#334155" />
          </View>

          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Angazhimi</Text>
              <Text style={styles.panelValue}>{overview?.engagementRate || 0}%</Text>
            </View>
            <Text style={styles.panelHint}>Mesatarja e pëlqimeve + komenteve për postim</Text>
            <View style={styles.metricRow}>
              <View style={[styles.metricBox, styles.metricBoxInPanel]}>
                <Text style={styles.metricLabel}>Postime</Text>
                <Text style={styles.metricValue}>{formatNumber(overview?.totalPosts)}</Text>
              </View>
              <View style={[styles.metricBox, styles.metricBoxInPanel]}>
                <Text style={styles.metricLabel}>Duke ndjekur</Text>
                <Text style={styles.metricValue}>{formatNumber(overview?.totalFollowing)}</Text>
              </View>
              <View style={[styles.metricBox, styles.metricBoxInPanel]}>
                <Text style={styles.metricLabel}>Ndjekës të rinj</Text>
                <Text style={styles.metricValue}>+{formatNumber(newFollowers)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Rritja e ndjekësve</Text>
            <MiniBars series={followerGrowth} />
          </View>

          {engagementSeries.length > 0 ? (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Angazhimi në kohë</Text>
              <MiniBars series={engagementSeries} />
            </View>
          ) : null}

          {postType ? (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Llojet e postimeve</Text>
              <View style={styles.compareRow}>
                <View style={styles.compareCard}>
                  <Ionicons name="image-outline" size={20} color="#0F766E" />
                  <Text style={styles.compareTitle}>Me foto</Text>
                  <Text style={styles.compareValue}>{postType.withImage?.count || 0}</Text>
                  <Text style={styles.compareMeta}>avg {postType.withImage?.avgLikes || 0} likes</Text>
                </View>
                <View style={styles.compareCard}>
                  <Ionicons name="document-text-outline" size={20} color="#F59E0B" />
                  <Text style={styles.compareTitle}>Vetëm tekst</Text>
                  <Text style={styles.compareValue}>{postType.withoutImage?.count || 0}</Text>
                  <Text style={styles.compareMeta}>avg {postType.withoutImage?.avgLikes || 0} likes</Text>
                </View>
              </View>
            </View>
          ) : null}

          {topPosts.length > 0 ? (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Top postimet</Text>
              {topPosts.map((post, idx) => (
                <View key={String(post.id || idx)} style={styles.topPostRow}>
                  <View style={styles.rankPill}>
                    <Text style={styles.rankPillText}>#{idx + 1}</Text>
                  </View>
                  <View style={styles.topPostBody}>
                    <Text style={styles.topPostText} numberOfLines={2}>
                      {post.content || post.caption || 'Postim pa tekst'}
                    </Text>
                    <Text style={styles.topPostMeta}>
                      {formatNumber(post.likesCount)} pëlqime · {formatNumber(post.commentsCount)} komente
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <View>
          <View style={styles.xpHero}>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeLabel}>Nivel</Text>
              <Text style={styles.levelBadgeValue}>{level}</Text>
            </View>
            <View style={styles.xpBody}>
              <Text style={styles.xpTitle}>{formatNumber(points)} XP</Text>
              <Text style={styles.xpSub}>
                {xpInLevel}/1000 deri te niveli {level + 1}
              </Text>
              <ProgressBar progress={xpProgress} />
              <Text style={styles.xpPct}>{xpProgress}%</Text>
            </View>
          </View>

          <View style={[styles.metricRow, { paddingHorizontal: 12 }]}>
            <View style={[styles.metricBox, styles.metricBoxWide]}>
              <Text style={styles.metricLabel}>Arritje</Text>
              <Text style={styles.metricValue}>
                {unlockedAchievements.length}/{achievements.length || unlockedAchievements.length}
              </Text>
            </View>
            <View style={[styles.metricBox, styles.metricBoxWide]}>
              <Text style={styles.metricLabel}>Badge</Text>
              <Text style={styles.metricValue}>
                {earnedBadges.length}/{badges.length || earnedBadges.length}
              </Text>
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Arritjet</Text>
            {achievements.length === 0 ? (
              <Text style={styles.muted}>Nuk ka arritje ende.</Text>
            ) : (
              <>
                {unlockedAchievements.slice(0, 6).map((a) => (
                  <View key={String(a.id || a.key || a.name)} style={styles.achRow}>
                    <View style={[styles.achIcon, styles.achIconOn]}>
                      <Ionicons name="trophy" size={18} color="#B45309" />
                    </View>
                    <View style={styles.achBody}>
                      <Text style={styles.achTitle}>{a.name || a.title || 'Arritje'}</Text>
                      {a.description ? <Text style={styles.achDesc}>{a.description}</Text> : null}
                      <Text style={styles.achStatusOn}>E hapur</Text>
                    </View>
                  </View>
                ))}
                {lockedAchievements.slice(0, 4).map((a) => (
                  <View key={String(a.id || a.key || a.name)} style={[styles.achRow, styles.achRowLocked]}>
                    <View style={styles.achIcon}>
                      <Ionicons name="lock-closed-outline" size={16} color="#94A3B8" />
                    </View>
                    <View style={styles.achBody}>
                      <Text style={styles.achTitleLocked}>{a.name || a.title || 'Arritje'}</Text>
                      {a.description ? <Text style={styles.achDesc}>{a.description}</Text> : null}
                      <ProgressBar progress={a.progress || 0} color="#94A3B8" />
                      <Text style={styles.achStatusOff}>{Math.round(a.progress || 0)}% progres</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Badge</Text>
            {badges.length === 0 ? (
              <Text style={styles.muted}>Nuk ka badge ende.</Text>
            ) : (
              <View style={styles.badgeGrid}>
                {badges.slice(0, 8).map((b) => {
                  const tone = rarityTone(b.rarity);
                  const earned = !!b.earned;
                  return (
                    <View
                      key={String(b.id || b.name)}
                      style={[
                        styles.badgeCard,
                        { borderColor: earned ? tone.border : '#E2E8F0', backgroundColor: earned ? tone.bg : '#F8FAFC' },
                        !earned && styles.badgeCardLocked,
                      ]}
                    >
                      <Text style={styles.badgeEmoji}>{b.icon || '🏅'}</Text>
                      <Text style={styles.badgeName} numberOfLines={2}>
                        {b.name || b.title}
                      </Text>
                      <Text style={[styles.badgeRarity, { color: tone.label }]}>
                        {(b.rarity || 'common').toString()}
                      </Text>
                      <Text style={earned ? styles.achStatusOn : styles.achStatusOff}>
                        {earned ? 'Fituar' : 'I kyçur'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Renditja</Text>
            {leaderboard.length === 0 ? (
              <Text style={styles.muted}>Nuk ka të dhëna për leaderboard.</Text>
            ) : (
              leaderboard.map((item, idx) => {
                const rank = Number(item.rank || idx + 1);
                const medal =
                  rank === 1 ? '#F59E0B' : rank === 2 ? '#94A3B8' : rank === 3 ? '#B45309' : '#E2E8F0';
                const photo = absoluteBackendUrl(item.profilePhoto || item.avatar || '');
                return (
                  <View key={String(item.id || idx)} style={styles.lbRow}>
                    <View style={[styles.lbRank, { backgroundColor: medal }]}>
                      <Text style={[styles.lbRankText, rank > 3 && styles.lbRankTextDark]}>#{rank}</Text>
                    </View>
                    {photo ? (
                      <Image source={{ uri: photo }} style={styles.lbAvatar} />
                    ) : (
                      <View style={[styles.lbAvatar, styles.lbAvatarFallback]}>
                        <Ionicons name="person" size={16} color="#64748B" />
                      </View>
                    )}
                    <View style={styles.lbBody}>
                      <Text style={styles.lbName}>
                        {item.firstName || ''} {item.lastName || ''}
                      </Text>
                      <Text style={styles.lbMeta}>
                        Nivel {item.level || 1} · {formatNumber(item.points)} XP
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { paddingBottom: 36 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { marginTop: 10, color: '#64748B' },
  hero: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
  },
  heroEyebrow: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  heroTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginBottom: 6 },
  heroSub: { color: '#CBD5E1', fontSize: 14, lineHeight: 20, marginBottom: 14 },
  segment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentBtnActive: { backgroundColor: '#F59E0B' },
  segmentText: { marginLeft: 6, color: '#94A3B8', fontWeight: '700', fontSize: 13 },
  segmentTextActive: { color: '#0F172A' },
  error: { color: '#B91C1C', marginHorizontal: 16, marginTop: 12 },
  periodRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 14, marginBottom: 8 },
  periodChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    marginRight: 8,
  },
  periodChipActive: { backgroundColor: '#0F766E' },
  periodText: { color: '#475569', fontWeight: '700', fontSize: 13 },
  periodTextActive: { color: '#FFFFFF' },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  statTile: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  statLabel: { marginTop: 2, color: '#64748B', fontSize: 13, fontWeight: '600' },
  panel: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  panelTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
  panelValue: { fontSize: 22, fontWeight: '800', color: '#0F766E' },
  panelHint: { color: '#64748B', fontSize: 13, marginBottom: 12, marginTop: -4 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  metricBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  metricBoxWide: { marginTop: 4, backgroundColor: '#FFFFFF' },
  metricBoxInPanel: { backgroundColor: '#F8FAFC', borderColor: 'transparent' },
  metricLabel: { color: '#64748B', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  metricValue: { color: '#0F172A', fontSize: 18, fontWeight: '800' },
  barsRow: {
    height: 84,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  barCol: { flex: 1, alignItems: 'center', marginHorizontal: 2 },
  bar: {
    width: '100%',
    maxWidth: 18,
    borderRadius: 6,
    backgroundColor: '#0F766E',
  },
  muted: { color: '#94A3B8', fontSize: 14 },
  compareRow: { flexDirection: 'row', justifyContent: 'space-between' },
  compareCard: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
  },
  compareTitle: { marginTop: 8, fontWeight: '700', color: '#0F172A' },
  compareValue: { marginTop: 4, fontSize: 22, fontWeight: '800', color: '#0F172A' },
  compareMeta: { marginTop: 2, color: '#64748B', fontSize: 12 },
  topPostRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  rankPill: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 10,
    marginTop: 2,
  },
  rankPillText: { color: '#B45309', fontWeight: '800', fontSize: 12 },
  topPostBody: { flex: 1 },
  topPostText: { color: '#0F172A', fontWeight: '600', lineHeight: 20 },
  topPostMeta: { marginTop: 4, color: '#64748B', fontSize: 12 },
  xpHero: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  levelBadge: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  levelBadgeLabel: { color: '#0F172A', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  levelBadgeValue: { color: '#0F172A', fontSize: 28, fontWeight: '800' },
  xpBody: { flex: 1 },
  xpTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  xpSub: { color: '#CBD5E1', fontSize: 13, marginTop: 2, marginBottom: 10 },
  xpPct: { color: '#FBBF24', fontSize: 12, fontWeight: '700', marginTop: 6 },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999 },
  achRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  achRowLocked: { opacity: 0.85 },
  achIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  achIconOn: { backgroundColor: '#FEF3C7' },
  achBody: { flex: 1 },
  achTitle: { color: '#0F172A', fontWeight: '700', fontSize: 15 },
  achTitleLocked: { color: '#475569', fontWeight: '700', fontSize: 15 },
  achDesc: { color: '#64748B', fontSize: 13, marginTop: 2, marginBottom: 6, lineHeight: 18 },
  achStatusOn: { color: '#0F766E', fontSize: 12, fontWeight: '700', marginTop: 4 },
  achStatusOff: { color: '#94A3B8', fontSize: 12, fontWeight: '600', marginTop: 4 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  badgeCard: {
    width: '48%',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  badgeCardLocked: { opacity: 0.7 },
  badgeEmoji: { fontSize: 28, marginBottom: 6 },
  badgeName: { fontWeight: '700', color: '#0F172A', textAlign: 'center', fontSize: 13 },
  badgeRarity: { marginTop: 4, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  lbRank: {
    width: 36,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  lbRankText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  lbRankTextDark: { color: '#0F172A' },
  lbAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  lbAvatarFallback: { backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  lbBody: { flex: 1 },
  lbName: { color: '#0F172A', fontWeight: '700' },
  lbMeta: { color: '#64748B', fontSize: 12, marginTop: 2 },
});
