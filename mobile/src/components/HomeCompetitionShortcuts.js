import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from '../theme/nativeComponents';
import { useNavigation } from '@react-navigation/native';

const ICON_MATCHES = require('../../assets/home/icon-matches.png');
const ICON_TOURNAMENTS = require('../../assets/home/icon-tournaments.png');
const ICON_MY_TOURNAMENTS = require('../../assets/home/icon-my-tournaments.png');

/**
 * Horizontal competition icons at the top — scrolls with feed content.
 */
export default function HomeCompetitionShortcuts({
  onPressMatches,
  onPressTournaments,
  onPressMyTournaments,
  compact = false,
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
      label: 'Turnetë e mia',
      onPress: onPressMyTournaments || (() => goMore('Tournaments', { filter: 'mine' })),
    },
  ];

  const size = compact ? 40 : 48;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.key}
          onPress={item.onPress}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Image
            source={item.icon}
            style={{ width: size, height: size, backgroundColor: 'transparent' }}
            resizeMode="contain"
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
    gap: 10,
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  wrapCompact: {
    flex: 1,
    paddingBottom: 0,
    paddingTop: 0,
    paddingHorizontal: 4,
    gap: 8,
  },
});
