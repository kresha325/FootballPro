import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { parseProfileJsonArray } from '../../utils/profileArrays';

function ProfileTrophyCard({ item, theme }) {
  const progress = item?.progress != null ? Math.min(100, Math.max(0, Number(item.progress))) : 100;
  return (
    <View style={[styles.trophyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={styles.trophyIcon}>{item?.icon || '🏆'}</Text>
      <Text style={[styles.trophyTitle, { color: theme.text }]}>{item?.title || item?.name || 'Achievement'}</Text>
      {item?.type ? <Text style={[styles.trophyType, { color: theme.muted }]}>{item.type}</Text> : null}
      {item?.description ? (
        <Text style={[styles.trophyDesc, { color: theme.muted }]}>{item.description}</Text>
      ) : null}
      <View style={[styles.progressTrack, { backgroundColor: theme.chipBg }]}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <Text style={styles.progressPct}>{progress}%</Text>
    </View>
  );
}

function PlatformAchievementRow({ item, theme }) {
  const unlocked = !!item?.unlocked;
  const progress = item?.progress != null ? Math.min(100, Math.max(0, Number(item.progress))) : unlocked ? 100 : 0;
  return (
    <View style={[styles.platformRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={styles.platformIcon}>{unlocked ? '✓' : '○'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.platformTitle, { color: theme.text }]}>
          {item?.name || item?.title || 'Achievement'}
        </Text>
        {item?.description ? (
          <Text style={[styles.platformDesc, { color: theme.muted }]} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        {!unlocked && progress > 0 ? (
          <View style={[styles.progressTrack, { backgroundColor: theme.chipBg, marginTop: 8 }]}>
            <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: '#9333ea' }]} />
          </View>
        ) : null}
      </View>
      {unlocked ? <Text style={styles.unlockedBadge}>Unlocked</Text> : null}
    </View>
  );
}

export default function PublicProfileAchievementsTab({
  profile,
  theme,
  platformAchievements = [],
  isSelf = false,
  onOpenInsights,
}) {
  const trophies = useMemo(
    () => parseProfileJsonArray(profile?.achievements),
    [profile?.achievements]
  );

  const unlockedPlatform = platformAchievements.filter((a) => a.unlocked);
  const hasTrophies = trophies.length > 0;
  const hasPlatform = isSelf && platformAchievements.length > 0;

  if (!hasTrophies && !hasPlatform) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: theme.muted }]}>No achievements yet.</Text>
        {isSelf && onOpenInsights ? (
          <TouchableOpacity style={styles.linkBtn} onPress={onOpenInsights}>
            <Text style={styles.linkBtnText}>Open Insights</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  return (
    <View>
      {hasTrophies ? (
        <>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Trophies & awards</Text>
          <View style={styles.trophyGrid}>
            {trophies.map((item, idx) => (
              <ProfileTrophyCard key={String(item?.id ?? item?.title ?? idx)} item={item} theme={theme} />
            ))}
          </View>
        </>
      ) : null}

      {hasPlatform ? (
        <>
          <Text style={[styles.sectionTitle, { color: theme.text, marginTop: hasTrophies ? 16 : 0 }]}>
            Platform achievements ({unlockedPlatform.length}/{platformAchievements.length})
          </Text>
          {platformAchievements.slice(0, 12).map((item) => (
            <PlatformAchievementRow key={String(item.id)} item={item} theme={theme} />
          ))}
          {platformAchievements.length > 12 ? (
            <Text style={[styles.moreHint, { color: theme.muted }]}>
              +{platformAchievements.length - 12} more in Insights
            </Text>
          ) : null}
        </>
      ) : null}

      {isSelf && onOpenInsights ? (
        <TouchableOpacity style={styles.linkBtn} onPress={onOpenInsights}>
          <Text style={styles.linkBtnText}>See full gamification in Insights</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: 28, alignItems: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  trophyGrid: { gap: 12 },
  trophyCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
  },
  trophyIcon: { fontSize: 32, marginBottom: 8 },
  trophyTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  trophyType: { fontSize: 13, marginTop: 4 },
  trophyDesc: { fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 18 },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#a855f7', borderRadius: 4 },
  progressPct: { marginTop: 6, fontWeight: '800', color: '#7e22ce', fontSize: 13 },
  platformRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  platformIcon: { fontSize: 18, fontWeight: '800', color: '#0f766e', marginTop: 2 },
  platformTitle: { fontWeight: '700', fontSize: 15 },
  platformDesc: { fontSize: 13, marginTop: 4 },
  unlockedBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803d',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  moreHint: { fontSize: 13, marginTop: 4, marginBottom: 8 },
  linkBtn: {
    marginTop: 16,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  linkBtnText: { color: '#0f766e', fontWeight: '800', fontSize: 15 },
});
