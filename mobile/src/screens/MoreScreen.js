import React, { useCallback, useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useUnreadBadges } from '../hooks/useUnreadBadges';

function MenuButton({ title, subtitle, onPress, badge, colors }) {
  const badgeNum = Number(badge || 0);
  return (
    <TouchableOpacity
      style={[styles.menuButton, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.menuRow}>
        <View style={styles.menuTextCol}>
          <Text style={[styles.menuTitle, { color: colors.text }]}>{title}</Text>
          {subtitle ? <Text style={[styles.menuSubtitle, { color: colors.muted }]}>{subtitle}</Text> : null}
        </View>
        {badgeNum > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeNum > 99 ? '99+' : String(badgeNum)}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function MoreScreen({ navigation }) {
  const { user, getSocket, socketConnected, logout } = useAuth();
  const { colors } = useTheme();
  const { notificationsCount, messagesCount, refresh } = useUnreadBadges(getSocket, socketConnected);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const alertLines = useMemo(() => {
    const parts = [];
    if (messagesCount > 0) {
      parts.push(
        messagesCount === 1
          ? '1 mesazh i palexuar — shiko Chats ose Messages më poshtë.'
          : `${messagesCount} mesazhe të palexuara — shiko Chats ose Messages më poshtë.`
      );
    }
    if (notificationsCount > 0) {
      parts.push(
        notificationsCount === 1
          ? '1 njoftim i ri.'
          : `${notificationsCount} njoftime të reja.`
      );
    }
    return parts;
  }, [messagesCount, notificationsCount]);

  const canUseScouting = user?.role === 'scout' || user?.role === 'club';
  const canUseInsights = ['athlete', 'coach', 'club', 'scout', 'manager', 'business', 'federation', 'admin'].includes(
    user?.role
  );
  const isAdmin = user?.role === 'admin';
  const isClub = user?.role === 'club';
  const canUseParentVerification = user?.role === 'athlete';

  const btn = (props) => <MenuButton {...props} colors={colors} />;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bgElevated }]}
      contentContainerStyle={styles.content}
    >
      <View
        style={[
          styles.headerCard,
          { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.text }]}>More</Text>
        <Text style={[styles.headerSubtitle, { color: colors.primaryText }]}>Menu — si burger në web</Text>
      </View>

      {alertLines.length > 0 ? (
        <View
          style={[
            styles.alertBanner,
            { backgroundColor: colors.warningSoft, borderColor: colors.warningBorder },
          ]}
        >
          {alertLines.map((line) => (
            <Text key={line} style={[styles.alertText, { color: colors.warningText }]}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}

      <Text style={[styles.sectionLabel, { color: colors.muted }]}>Njoftime & mesazhe</Text>
      {btn({
        title: 'Notifications',
        subtitle: 'Like, comment, follow, turne…',
        badge: notificationsCount,
        onPress: () =>
          navigation.navigate({
            name: 'Notifications',
          }),
      })}
      {btn({
        title: 'Messages',
        subtitle: 'Biseda private (edhe nga tab Chats)',
        badge: messagesCount,
        onPress: () => {
          const tabs = navigation.getParent?.();
          if (tabs?.navigate) {
            tabs.navigate('Messages', { screen: 'MessagingHome' });
          }
        },
      })}

      <Text style={[styles.sectionLabel, { color: colors.muted, marginTop: 8 }]}>Module</Text>
      {btn({ title: 'Wallet', subtitle: 'XCoin balance and transactions', onPress: () => navigation.navigate('Wallet') })}
      {canUseInsights
        ? btn({
            title: 'Insights',
            subtitle: 'Analitika e profilit, XP dhe arritje',
            onPress: () => navigation.navigate('Insights'),
          })
        : null}
      {btn({ title: 'Tournaments', subtitle: 'Trending and join flow', onPress: () => navigation.navigate('Tournaments') })}
      {btn({ title: 'Videos', subtitle: 'Trending uploads and likes', onPress: () => navigation.navigate('Videos') })}
      {canUseScouting
        ? btn({
            title: 'Scouting',
            subtitle: 'Recommendations and filters',
            onPress: () => navigation.navigate('Scouting'),
          })
        : null}
      {btn({ title: 'Search', subtitle: 'Users, posts and discovery', onPress: () => navigation.navigate('Search') })}
      {btn({ title: 'Matches', subtitle: 'View and schedule matches', onPress: () => navigation.navigate('Matches') })}
      {btn({
        title: 'Streams & Go Live',
        subtitle: 'Live, regjistrime, ngarkim video',
        onPress: () => navigation.navigate('GoLive'),
      })}
      {btn({ title: 'Premium', subtitle: 'Membership plans and perks', onPress: () => navigation.navigate('Premium') })}
      {btn({ title: 'Sponsors', subtitle: 'Manage your sponsor deals', onPress: () => navigation.navigate('Sponsors') })}
      {btn({ title: 'Ads', subtitle: 'Create and view active ads', onPress: () => navigation.navigate('Ads') })}
      {btn({ title: 'Settings', subtitle: 'Profile and app preferences', onPress: () => navigation.navigate('Settings') })}
      {btn({
        title: 'Dil nga llogaria',
        subtitle: 'Logout',
        onPress: () => {
          Alert.alert('Dil', 'Dal nga llogaria?', [
            { text: 'Anulo', style: 'cancel' },
            { text: 'Dil', style: 'destructive', onPress: () => logout() },
          ]);
        },
      })}
      {canUseParentVerification
        ? btn({
            title: 'Parent Verification',
            subtitle: 'Send parent verification email',
            onPress: () => navigation.navigate('ParentVerification'),
          })
        : null}
      {isClub
        ? btn({
            title: 'Club Roster',
            subtitle: 'Manage requests and squad',
            onPress: () => navigation.navigate('ClubRoster'),
          })
        : null}
      {isAdmin
        ? btn({
            title: 'Admin Dashboard',
            subtitle: 'Users and platform analytics',
            onPress: () => navigation.navigate('AdminDashboard'),
          })
        : null}

      {!canUseScouting ? (
        <View
          style={[
            styles.noteCard,
            { backgroundColor: colors.warningSoft, borderColor: colors.warningBorder },
          ]}
        >
          <Text style={[styles.noteTitle, { color: colors.warningText }]}>Scouting Access</Text>
          <Text style={[styles.noteText, { color: colors.warningText }]}>
            Scouting features are available for scout or club roles.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 30 },
  headerCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  headerTitle: { fontWeight: '800', fontSize: 20 },
  headerSubtitle: { marginTop: 4 },
  alertBanner: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  alertText: { fontWeight: '600', marginBottom: 4 },
  sectionLabel: {
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  menuButton: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center' },
  menuTextCol: { flex: 1, paddingRight: 8 },
  menuTitle: { fontWeight: '800' },
  menuSubtitle: { marginTop: 4 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  noteCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  noteTitle: { fontWeight: '700' },
  noteText: { marginTop: 4 },
});
