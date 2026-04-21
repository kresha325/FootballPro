import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  ImageBackground,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export function useBrowseColors(isDark) {
  return useMemo(
    () => ({
      bg: isDark ? '#020617' : '#f1f5f9',
      card: isDark ? '#0f172a' : '#ffffff',
      border: isDark ? '#334155' : '#e2e8f0',
      text: isDark ? '#f8fafc' : '#0f172a',
      muted: isDark ? '#94a3b8' : '#64748b',
      chipBg: isDark ? '#1e293b' : '#ecfdf5',
      chipText: isDark ? '#5eead4' : '#0f766e',
      inputBg: isDark ? '#0f172a' : '#ffffff',
      shadow: '#000',
    }),
    [isDark]
  );
}

/** Normalizon përdorues nga API (User + Profile i mbështjellë). */
export function normalizeBrowseUser(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id ?? raw.userId;
  if (id == null) return null;
  const p = raw.Profile || raw.profile || {};
  return {
    id,
    firstName: raw.firstName,
    lastName: raw.lastName,
    role: raw.role,
    verified: raw.verified,
    profilePhoto: raw.profilePhoto ?? p.profilePhoto,
    club: raw.club ?? p.club,
    position: raw.position ?? p.position,
    city: raw.city ?? p.city,
    country: raw.country ?? p.country,
  };
}

function roleLabel(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'trajner') return 'Coach';
  if (!r) return 'Member';
  return r.charAt(0).toUpperCase() + r.slice(1);
}

function ProfileBrowseCard({ item, onPress, colors }) {
  const name = `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'User';
  const initials = `${(item.firstName || 'U').charAt(0)}${(item.lastName || '').charAt(0)}`.toUpperCase();
  const photo = item.profilePhoto && typeof item.profilePhoto === 'string' ? item.profilePhoto : null;
  const location = [item.city, item.country].filter(Boolean).join(', ');

  const overlayContent = (
    <>
      <View style={styles.overlayNameRow}>
        <Text style={styles.overlayName} numberOfLines={2}>
          {name}
        </Text>
        {item.verified ? <Ionicons name="checkmark-circle" size={26} color="#93c5fd" style={styles.overlayVerified} /> : null}
      </View>
      <View style={styles.overlayRolePill}>
        <Text style={styles.overlayRoleText} numberOfLines={1}>
          {roleLabel(item.role)}
        </Text>
      </View>
      {item.club ? (
        <View style={styles.overlayMetaRow}>
          <Ionicons name="business-outline" size={17} color="rgba(255,255,255,0.9)" style={styles.overlayMetaIcon} />
          <Text style={styles.overlayMetaText} numberOfLines={2}>
            {item.club}
          </Text>
        </View>
      ) : null}
      {item.position ? (
        <View style={styles.overlayMetaRow}>
          <Ionicons name="football-outline" size={17} color="rgba(255,255,255,0.9)" style={styles.overlayMetaIcon} />
          <Text style={styles.overlayMetaText} numberOfLines={2}>
            {item.position}
          </Text>
        </View>
      ) : null}
      {location ? (
        <View style={styles.overlayMetaRow}>
          <Ionicons name="location-outline" size={17} color="rgba(255,255,255,0.9)" style={styles.overlayMetaIcon} />
          <Text style={styles.overlayMetaText} numberOfLines={2}>
            {location}
          </Text>
        </View>
      ) : null}
      <View style={styles.overlayHintRow}>
        <Text style={styles.overlayHint}>Profili i plotë</Text>
        <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.85)" />
      </View>
    </>
  );

  return (
    <TouchableOpacity
      style={[
        styles.feedCard,
        {
          borderColor: colors.border,
          shadowColor: colors.shadow,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.95}
    >
      {photo ? (
        <ImageBackground
          source={{ uri: photo }}
          style={styles.cardFill}
          imageStyle={styles.cardCoverImage}
          resizeMode="cover"
        >
          <View style={styles.cardFillInner}>
            <View style={styles.scrim} />
            <View style={styles.overlayPanel}>{overlayContent}</View>
          </View>
        </ImageBackground>
      ) : (
        <View style={[styles.cardFill, styles.cardFallbackBg]}>
          <View style={styles.fallbackInitialsWrap}>
            <Text style={styles.fallbackInitials}>{initials}</Text>
          </View>
          <View style={styles.cardFillInner}>
            <View style={styles.scrim} />
            <View style={styles.overlayPanel}>{overlayContent}</View>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

/**
 * Lista vertikale me një kartë profili për “faqe” (si Browse Profiles).
 * `data` mund të jetë përdorues të papërpunuar nga API; normalizohen brenda.
 */
export default function UserProfileBrowsePager({
  data = [],
  colors,
  onOpenProfile,
  refreshing = false,
  onRefresh,
  emptyMessage = 'No profiles found.',
}) {
  const [listViewportH, setListViewportH] = useState(0);
  const { height: windowH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const pageHeight = useMemo(() => {
    if (listViewportH > 0) return listViewportH;
    return Math.max(320, windowH - insets.top - insets.bottom - 120);
  }, [listViewportH, windowH, insets.top, insets.bottom]);

  const getItemLayout = useCallback(
    (_, index) => ({
      length: pageHeight,
      offset: pageHeight * index,
      index,
    }),
    [pageHeight]
  );

  const normalizedList = useMemo(() => {
    const rows = Array.isArray(data) ? data : [];
    return rows.map(normalizeBrowseUser).filter(Boolean);
  }, [data]);

  return (
    <View style={styles.listFlex} onLayout={(e) => setListViewportH(e.nativeEvent.layout.height)}>
      <FlatList
        data={normalizedList}
        keyExtractor={(item) => String(item.id)}
        key={pageHeight}
        style={styles.list}
        pagingEnabled
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        snapToInterval={pageHeight}
        snapToAlignment="start"
        disableIntervalMomentum
        getItemLayout={getItemLayout}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0f766e']} />
          ) : undefined
        }
        renderItem={({ item }) => (
          <View style={[styles.page, { height: pageHeight }]}>
            <View style={styles.pageInner}>
              <ProfileBrowseCard
                item={item}
                colors={colors}
                onPress={() => onOpenProfile?.(item.id)}
              />
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={[styles.emptyPage, { height: pageHeight }]}>
            <Text style={[styles.empty, { color: colors.muted }]}>{emptyMessage}</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  listFlex: { flex: 1 },
  list: { flex: 1 },
  page: { flex: 1 },
  pageInner: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 8,
    minHeight: 0,
  },
  feedCard: {
    flex: 1,
    minHeight: 0,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  cardFill: {
    flex: 1,
    width: '100%',
    minHeight: 0,
  },
  cardCoverImage: {
    borderRadius: 14,
  },
  cardFallbackBg: {
    backgroundColor: '#0f766e',
  },
  cardFillInner: {
    flex: 1,
    justifyContent: 'flex-end',
    minHeight: 0,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  fallbackInitialsWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackInitials: {
    fontSize: 96,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.35)',
  },
  overlayPanel: {
    paddingHorizontal: 18,
    paddingTop: 28,
    paddingBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  overlayNameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  overlayName: {
    flex: 1,
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 32,
  },
  overlayVerified: { marginLeft: 8, marginTop: 2 },
  overlayRolePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 14,
  },
  overlayRoleText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  overlayMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  overlayMetaIcon: { marginRight: 10, marginTop: 3, width: 20 },
  overlayMetaText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
    lineHeight: 22,
  },
  overlayHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.35)',
  },
  overlayHint: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
  },
  emptyPage: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  empty: { fontSize: 16, textAlign: 'center' },
});
