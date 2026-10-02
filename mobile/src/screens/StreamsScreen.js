import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from '../theme/nativeComponents';
import { ResizeMode, Video } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ListSearchBar from '../components/ListSearchBar';
import { absoluteBackendUrl } from '../config/constants';
import { extractErrorMessage, streamsRequest } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { filterBySearch } from '../utils/listSearch';
import { dedupeLiveByStreamer } from '../utils/liveStreams';

function streamerName(stream) {
  const s = stream?.streamer || stream?.User || {};
  return `${s.firstName || ''} ${s.lastName || ''}`.trim() || stream?.title || 'Live';
}

function streamerPhoto(stream) {
  const s = stream?.streamer || stream?.User || {};
  const raw = s.photoUrl || s.Profile?.profilePhoto || s.profilePhoto;
  return absoluteBackendUrl(raw) || raw || null;
}

function recordingUri(videoUrl) {
  return absoluteBackendUrl(videoUrl) || videoUrl || null;
}

export default function StreamsScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [listSearch, setListSearch] = useState('');

  const theme = useMemo(
    () => ({
      bg: isDark ? '#0f172a' : '#f8fafc',
      card: colors.card || (isDark ? '#1e293b' : '#fff'),
      text: colors.text || (isDark ? '#f8fafc' : '#0f172a'),
      muted: colors.muted || (isDark ? '#94a3b8' : '#64748b'),
      border: colors.border || (isDark ? '#334155' : '#e2e8f0'),
      gold: colors.primary || '#9A6B12',
    }),
    [colors, isDark]
  );

  const load = useCallback(async ({ silent } = { silent: false }) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await streamsRequest({ limit: 50 });
      setStreams(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setStreams([]);
      setError(extractErrorMessage(err, 'Nuk u ngarkuan stream-et'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load({ silent: true });
    }, [load])
  );

  const liveStreams = useMemo(
    () => dedupeLiveByStreamer((streams || []).filter((s) => s.isLive)),
    [streams]
  );

  const filteredLive = useMemo(
    () =>
      filterBySearch(liveStreams, listSearch, (s) => [
        s.title,
        s.description,
        s.streamer?.firstName,
        s.streamer?.lastName,
        s.User?.firstName,
        s.User?.lastName,
      ]),
    [liveStreams, listSearch]
  );

  const recorded = useMemo(() => {
    const rec = (streams || []).filter((s) => !s.isLive && s.videoUrl);
    return filterBySearch(rec, listSearch, (s) => [
      s.title,
      s.description,
      s.streamer?.firstName,
      s.streamer?.lastName,
      s.User?.firstName,
      s.User?.lastName,
    ]);
  }, [streams, listSearch]);

  const openLive = (streamId) => {
    if (!streamId) return;
    navigation.navigate('LiveViewer', { streamId });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 28, paddingTop: 12 }}
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
      <View style={styles.headerPad}>
        <Text style={[styles.h1, { color: theme.text }]}>Streams</Text>
        <Text style={[styles.sub, { color: theme.muted }]}>
          Live aktive dhe regjistrime. Nis Go Live nga butoni më poshtë.
        </Text>
        <TouchableOpacity
          style={[styles.goLiveBtn, { backgroundColor: '#dc2626' }]}
          onPress={() => navigation.navigate('GoLive')}
        >
          <Text style={styles.goLiveText}>Go Live</Text>
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 14, marginBottom: 12 }}>
        <ListSearchBar
          value={listSearch}
          onChangeText={setListSearch}
          placeholder="Kërko stream sipas titullit ose streamer-it…"
          colors={theme}
        />
      </View>

      {error ? (
        <Text style={[styles.error, { color: '#dc2626' }]}>{error}</Text>
      ) : null}

      {loading && !streams.length ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.gold} />
        </View>
      ) : null}

      {filteredLive.length > 0 ? (
        <View style={[styles.liveBox, { borderColor: '#fecaca', backgroundColor: isDark ? '#450a0a55' : '#fef2f2' }]}>
          <Text style={styles.liveTitle}>Live Now</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.liveRow}>
            {filteredLive.map((stream) => {
              const name = streamerName(stream);
              const photo = streamerPhoto(stream);
              return (
                <TouchableOpacity
                  key={String(stream.id)}
                  style={styles.liveItem}
                  onPress={() => openLive(stream.id)}
                  activeOpacity={0.85}
                >
                  {photo ? (
                    <Image source={{ uri: photo }} style={styles.liveAvatar} />
                  ) : (
                    <View style={[styles.liveAvatar, styles.liveAvatarFallback]}>
                      <Text style={styles.liveAvatarLetter}>{name.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={[styles.liveName, { color: theme.text }]} numberOfLines={2}>
                    {name}
                  </Text>
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveBadgeText}>LIVE</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : !loading ? (
        <View style={[styles.emptyLive, { borderColor: theme.border, backgroundColor: theme.card }]}>
          <Text style={{ color: theme.muted, textAlign: 'center' }}>Asnjë stream live tani.</Text>
        </View>
      ) : null}

      <View style={styles.headerPad}>
        <Text style={[styles.h2, { color: theme.text }]}>Regjistrime</Text>
      </View>

      {recorded.length === 0 && !loading ? (
        <Text style={[styles.emptyRec, { color: theme.muted }]}>Nuk ka regjistrime ende.</Text>
      ) : (
        recorded.map((stream) => {
          const uri = recordingUri(stream.videoUrl);
          return (
            <View
              key={String(stream.id)}
              style={[styles.recCard, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <Text style={[styles.recTitle, { color: theme.text }]}>{stream.title || 'Stream'}</Text>
              {stream.description ? (
                <Text style={{ color: theme.muted, marginTop: 4 }}>{stream.description}</Text>
              ) : null}
              <Text style={[styles.recMeta, { color: theme.muted }]}>
                {streamerName(stream)} · Recorded
              </Text>
              {uri ? (
                <View style={styles.videoWrap}>
                  <Video
                    source={{ uri }}
                    style={styles.video}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                  />
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerPad: { paddingHorizontal: 14, marginBottom: 10 },
  h1: { fontSize: 28, fontWeight: '900' },
  h2: { fontSize: 18, fontWeight: '800', marginTop: 8 },
  sub: { fontSize: 14, marginTop: 6, lineHeight: 20 },
  goLiveBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  goLiveText: { color: '#fff', fontWeight: '800' },
  error: { paddingHorizontal: 14, marginBottom: 8 },
  center: { paddingVertical: 40, alignItems: 'center' },
  liveBox: {
    marginHorizontal: 14,
    marginBottom: 14,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingLeft: 12,
  },
  liveTitle: { fontSize: 15, fontWeight: '900', color: '#991b1b', marginBottom: 10 },
  liveRow: { paddingRight: 12, gap: 12 },
  liveItem: { width: 96, alignItems: 'center' },
  liveAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#ef4444',
    backgroundColor: '#e2e8f0',
  },
  liveAvatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#b91c1c' },
  liveAvatarLetter: { color: '#fff', fontWeight: '900', fontSize: 18 },
  liveName: { marginTop: 6, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' },
  liveBadgeText: { color: '#dc2626', fontWeight: '900', fontSize: 11 },
  emptyLive: {
    marginHorizontal: 14,
    marginBottom: 14,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  emptyRec: { paddingHorizontal: 14, marginBottom: 12 },
  recCard: {
    marginHorizontal: 14,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  recTitle: { fontSize: 16, fontWeight: '800' },
  recMeta: { fontSize: 12, marginTop: 6 },
  videoWrap: { marginTop: 10, borderRadius: 10, overflow: 'hidden', backgroundColor: '#000' },
  video: { width: '100%', height: 200 },
});
