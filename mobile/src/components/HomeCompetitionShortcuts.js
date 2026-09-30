import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from '../theme/nativeComponents';
import { useNavigation } from '@react-navigation/native';

const ICON_MATCHES = require('../../assets/home/icon-matches.png');
const ICON_TOURNAMENTS = require('../../assets/home/icon-tournaments.png');
const ICON_MY_TOURNAMENTS = require('../../assets/home/icon-my-tournaments.png');

/**
 * Three equal-width competition shortcut buttons at the top of the feed.
 */
export default function HomeCompetitionShortcuts({
  onPressMatches,
  onPressTournaments,
  onPressMyTournaments,
  compact = false,
  myTournamentsBadge = 0,
}) {
  const navigation = useNavigation();

  const goMore = (screen, params) => {
    const parent = navigation.getParent?.();
    if (parent?.navigate) {
      parent.navigate('More', { screen, params: params || undefined });
    } else {
      navigation.navigate(screen, params);
    }
  };

  const items = [
    {
      key: 'matches',
      icon: ICON_MATCHES,
      label: 'Ndeshjet',
      onPress: onPressMatches || (() => goMore('Matches')),
    },
    {
      key: 'tournaments',
      icon: ICON_TOURNAMENTS,
      label: 'Turne',
      onPress: onPressTournaments || (() => goMore('Tournaments')),
    },
    {
      key: 'mine',
      icon: ICON_MY_TOURNAMENTS,
      label: 'Të mia',
      badge: Number(myTournamentsBadge) || 0,
      onPress: onPressMyTournaments || (() => goMore('Tournaments', { filter: 'mine' })),
    },
  ];

  const iconSize = compact ? 28 : 34;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.key}
          style={[styles.btn, compact && styles.btnCompact]}
          onPress={item.onPress}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={
            item.badge > 0 ? `${item.label}, ${item.badge} njoftime` : item.label
          }
        >
          <View style={styles.iconWrap}>
            <Image
              source={item.icon}
              style={{ width: iconSize, height: iconSize, backgroundColor: 'transparent' }}
              resizeMode="contain"
            />
            {item.badge > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.badge > 9 ? '9+' : String(item.badge)}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.label, compact && styles.labelCompact]} numberOfLines={1}>
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    alignSelf: 'stretch',
    width: '100%',
    gap: 8,
    paddingHorizontal: 0,
    paddingTop: 4,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  wrapCompact: {
    flex: 1,
    paddingBottom: 0,
    paddingTop: 0,
    gap: 6,
  },
  btn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(154, 107, 18, 0.55)',
    backgroundColor: 'rgba(154, 107, 18, 0.12)',
  },
  btnCompact: {
    paddingVertical: 8,
    gap: 4,
  },
  iconWrap: {
    position: 'relative',
  },
  label: {
    color: '#E8D5A3',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  labelCompact: {
    fontSize: 11,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
});
