import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from '../theme/nativeComponents';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { absoluteBackendUrl } from '../config/constants';
import { APP_BRAND_NAME } from '../config/branding';
import { extractErrorMessage, publicProfileCvRequest } from '../api/client';
import { getFoundingYear, isOrgProfileRole } from '../utils/orgProfile';
import { openUserProfile } from '../utils/openUserProfile';
import { promptShareProfileCv } from '../utils/shareProfile';
import { useTheme } from '../context/ThemeContext';

const ROLE_LABELS = {
  athlete: 'Futbollist',
  coach: 'Trajner',
  trajner: 'Trajner',
  scout: 'Skaut',
  manager: 'Menaxher',
  referee: 'Arbitër',
  club: 'Klub',
  liga: 'Ligë',
  federation: 'Federatë',
  business: 'Business',
  media: 'Media',
};

function roleLabel(role) {
  return ROLE_LABELS[String(role || '').toLowerCase()] || role || 'Profil';
}

function formatCareer(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'string') return raw.trim() || null;
  if (Array.isArray(raw)) {
    return raw
      .map((row) => {
        if (typeof row === 'string') return row;
        if (!row || typeof row !== 'object') return null;
        const club = row.club || row.clubName || row.team || row.name || '';
        const season = row.season || '';
        return [club, season].filter(Boolean).join(' · ');
      })
      .filter(Boolean)
      .join('\n');
  }
  try {
    return JSON.stringify(raw, null, 2);
  } catch {
    return String(raw);
  }
}

function StatPill({ label, value, theme }) {
  if (value == null || value === '') return null;
  return (
    <View style={[styles.statPill, { backgroundColor: theme.chipBg, borderColor: theme.border }]}>
      <Text style={[styles.statValue, { color: '#9A6B12' }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

export default function PublicCvScreen({ route, navigation }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const userId = route.params?.userId ?? route.params?.id;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const theme = useMemo(
    () => ({
      bg: isDark ? '#0f172a' : '#f8fafc',
      card: isDark ? '#1e293b' : '#ffffff',
      text: colors.text || (isDark ? '#f8fafc' : '#0f172a'),
      muted: colors.muted || (isDark ? '#94a3b8' : '#64748b'),
      border: isDark ? '#334155' : '#e2e8f0',
      chipBg: isDark ? '#0f172a' : '#f1f5f9',
      gold: '#9A6B12',
    }),
    [colors, isDark]
  );

  const load = useCallback(
    async ({ silent } = { silent: false }) => {
      if (!userId) {
        setError('Mungon ID e profilit');
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      setError('');
      try {
        const res = await publicProfileCvRequest(userId);
        setProfile(res.data || null);
      } catch (err) {
        setProfile(null);
        setError(extractErrorMessage(err, 'Profili nuk u gjet ose nuk është publik.'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const displayName = useMemo(() => {
    if (!profile) return '';
    const full = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
    if (full) return full;
    return profile.club || roleLabel(profile.role);
  }, [profile]);

  useEffect(() => {
    navigation.setOptions({
      title: displayName ? `CV · ${displayName}` : 'CV dixhitale',
      headerRight: profile
        ? () => (
            <TouchableOpacity
              onPress={() => promptShareProfileCv(profile, { navigation, shareOnly: true })}
              style={{ paddingHorizontal: 10 }}
              accessibilityLabel="Ndaj CV"
            >
              <Text style={{ color: theme.gold, fontWeight: '800' }}>Ndaj</Text>
            </TouchableOpacity>
          )
        : undefined,
    });
  }, [navigation, displayName, profile, theme.gold]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.gold} />
        <Text style={[styles.muted, { color: theme.muted, marginTop: 12 }]}>Po ngarkohet CV…</Text>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg, padding: 24 }]}>
        <Text style={[styles.errorText, { color: theme.text }]}>{error || 'Profili nuk u gjet'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
          <Text style={styles.retryText}>Provo përsëri</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const stats = profile.stats && typeof profile.stats === 'object' ? profile.stats : {};
  const isOrg = isOrgProfileRole(profile.role);
  const founding = profile.foundingYear || getFoundingYear(profile);
  const gallery = Array.isArray(profile.galleryPreview) ? profile.galleryPreview : [];
  const role = String(profile.role || '').toLowerCase();
  const careerText = formatCareer(profile.careerHistory);
  const matches = Array.isArray(profile.matches) ? profile.matches : [];

  const heroStats = [];
  if (role === 'athlete') {
    [
      ['Ndeshje', stats.appearances ?? (matches.length || null)],
      ['Gola', stats.goals],
      ['Asiste', stats.assists],
      ['Minuta', stats.minutes],
      ['Turne', profile.tournamentTotals?.tournamentsPlayed],
    ].forEach(([label, value]) => {
      if (value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))) {
        heroStats.push({ label, value: Number(value) });
      }
    });
  } else {
    heroStats.push(
      { label: 'Ndjekës', value: profile.followers ?? 0 },
      { label: 'Duke ndjekur', value: profile.following ?? 0 },
      { label: 'Postime', value: profile.postsCount ?? 0 },
      { label: 'Galerie', value: profile.galleryCount ?? gallery.length }
    );
    if (role === 'club') {
      if (profile.athletesCount != null) heroStats.push({ label: 'Atletë', value: profile.athletesCount });
      if (profile.staffCount != null) heroStats.push({ label: 'Staf', value: profile.staffCount });
    }
  }

  const detailStats = [
    { label: 'Gjatësia', value: stats.height ? `${stats.height} cm` : null },
    { label: 'Pesha', value: stats.weight ? `${stats.weight} kg` : null },
    { label: 'Numri', value: stats.jerseyNumber ? `#${stats.jerseyNumber}` : null },
    { label: 'Këmba', value: stats.preferredFoot || null },
    { label: 'Stadiumi', value: profile.stadium || stats.stadium || null },
    { label: 'Kapaciteti', value: profile.capacity || stats.capacity || null },
    { label: 'Liga', value: profile.league || stats.league || null },
    { label: 'Themeluar', value: founding || stats.founded || null },
  ].filter((s) => s.value != null && s.value !== '');

  const photo = absoluteBackendUrl(profile.profilePhoto) || profile.profilePhoto;
  const cover = absoluteBackendUrl(profile.coverPhoto) || profile.coverPhoto;
  const profileUserId = profile.id || profile.userId || userId;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load({ silent: true });
          }}
          tintColor={theme.gold}
        />
      }
    >
      <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {cover ? (
          <ImageBackground source={{ uri: cover }} style={styles.cover} imageStyle={{ opacity: 0.9 }}>
            <View style={styles.coverShade} />
          </ImageBackground>
        ) : (
          <View style={[styles.cover, { backgroundColor: '#60491f' }]} />
        )}
        <View style={styles.heroBody}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 28 }}>
                {(displayName || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={[styles.name, { color: theme.text }]}>{displayName}</Text>
          <View style={styles.chipRow}>
            <View style={[styles.chip, { backgroundColor: 'rgba(154,107,18,0.15)' }]}>
              <Text style={[styles.chipText, { color: theme.gold }]}>{roleLabel(profile.role)}</Text>
            </View>
            {profile.position ? (
              <View style={[styles.chip, { backgroundColor: theme.chipBg }]}>
                <Text style={[styles.chipText, { color: theme.text }]}>{profile.position}</Text>
              </View>
            ) : null}
            {!isOrg && profile.age != null ? (
              <View style={[styles.chip, { backgroundColor: theme.chipBg }]}>
                <Text style={[styles.chipText, { color: theme.text }]}>
                  {profile.age} vjeç{profile.ageGroup ? ` · ${profile.ageGroup}` : ''}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.metaLine, { color: theme.muted }]}>
            {[profile.club, profile.city, profile.country].filter(Boolean).join(' · ')}
          </Text>
          <View style={styles.statGrid}>
            {heroStats.map((s) => (
              <StatPill key={s.label} label={s.label} value={s.value} theme={theme} />
            ))}
          </View>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.sectionEyebrow, { color: theme.gold }]}>Overview</Text>
        {profile.bio ? (
          <Text style={[styles.body, { color: theme.text }]}>{profile.bio}</Text>
        ) : (
          <Text style={{ color: theme.muted }}>Nuk ka bio publike ende.</Text>
        )}
        {careerText ? (
          <View style={[styles.careerBox, { borderTopColor: theme.border }]}>
            <Text style={[styles.sectionEyebrow, { color: theme.muted }]}>Karriera</Text>
            <Text style={[styles.body, { color: theme.text }]}>{careerText}</Text>
          </View>
        ) : null}
      </View>

      {detailStats.length ? (
        <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionEyebrow, { color: theme.gold }]}>Stats</Text>
          {detailStats.map((s) => (
            <View key={s.label} style={[styles.detailRow, { borderBottomColor: theme.border }]}>
              <Text style={{ color: theme.muted }}>{s.label}</Text>
              <Text style={{ color: theme.text, fontWeight: '700' }}>{s.value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {gallery.length ? (
        <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionEyebrow, { color: theme.gold }]}>Galerie</Text>
          <Text style={[styles.sub, { color: theme.muted }]}>Mediat e fundit</Text>
          <View style={styles.galleryGrid}>
            {gallery.slice(0, 5).map((item) => {
              const uri =
                absoluteBackendUrl(item.thumbnail || item.url || item.imageUrl || item.mediaUrl) ||
                item.thumbnail ||
                item.url ||
                item.imageUrl;
              return (
                <View key={String(item.id)} style={[styles.galleryCell, { backgroundColor: theme.chipBg }]}>
                  {uri ? <Image source={{ uri }} style={styles.galleryImg} /> : null}
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {matches.length ? (
        <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionEyebrow, { color: theme.gold }]}>Ndeshjet e fundit</Text>
          {matches.slice(0, 8).map((m, idx) => (
            <View key={String(m.id || idx)} style={[styles.matchRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.matchTitle, { color: theme.text }]}>
                {m.opponent || m.title || m.homeTeam || m.name || 'Ndeshje'}
              </Text>
              <Text style={{ color: theme.muted, fontSize: 13 }}>
                {[m.competition || m.tournament, m.score || m.result].filter(Boolean).join(' · ') || '—'}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: theme.gold }]}
          onPress={() => openUserProfile(navigation, profileUserId)}
        >
          <Text style={styles.primaryBtnText}>Shiko profilin e plotë</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: theme.border }]}
          onPress={() => promptShareProfileCv(profile, { navigation, shareOnly: true })}
        >
          <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Ndaj CV · {APP_BRAND_NAME}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { fontSize: 14 },
  errorText: { textAlign: 'center', fontSize: 16, fontWeight: '600', marginBottom: 16 },
  retryBtn: {
    backgroundColor: '#9A6B12',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { color: '#fff', fontWeight: '800' },
  heroCard: {
    margin: 14,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cover: { height: 140, width: '100%' },
  coverShade: { flex: 1, backgroundColor: 'rgba(15,23,42,0.35)' },
  heroBody: { padding: 16, alignItems: 'center', marginTop: -40 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#0f172a',
    backgroundColor: '#334155',
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  name: { marginTop: 12, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 10 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: 12, fontWeight: '700' },
  metaLine: { marginTop: 8, fontSize: 13, textAlign: 'center' },
  statGrid: {
    marginTop: 16,
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statPill: {
    width: '30%',
    flexGrow: 1,
    minWidth: '28%',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { marginTop: 2, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  section: {
    marginHorizontal: 14,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  body: { fontSize: 15, lineHeight: 22 },
  sub: { fontSize: 13, marginBottom: 10 },
  careerBox: { marginTop: 16, paddingTop: 14, borderTopWidth: 1 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  galleryCell: { width: '30%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', flexGrow: 1 },
  galleryImg: { width: '100%', height: '100%' },
  matchRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  matchTitle: { fontWeight: '700', marginBottom: 2 },
  actions: { paddingHorizontal: 14, gap: 10, marginTop: 4 },
  primaryBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '800' },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryBtnText: { fontWeight: '700' },
});
