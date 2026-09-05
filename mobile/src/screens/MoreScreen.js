import React, { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useUnreadBadges } from '../hooks/useUnreadBadges';

function MenuButton({ title, subtitle, onPress, badge }) {
  const badgeNum = Number(badge || 0);
  return (
    <TouchableOpacity style={styles.menuButton} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.menuRow}>
        <View style={styles.menuTextCol}>
          <Text style={styles.menuTitle}>{title}</Text>
          {subtitle ? <Text style={styles.menuSubtitle}>{subtitle}</Text> : null}
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
  const { user, getSocket, socketConnected } = useAuth();
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>More</Text>
        <Text style={styles.headerSubtitle}>Menu — si burger në web</Text>
      </View>

      {alertLines.length > 0 ? (
        <View style={styles.alertBanner}>
          {alertLines.map((line) => (
            <Text key={line} style={styles.alertText}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>Njoftime & mesazhe</Text>
      <MenuButton
        title="Notifications"
        subtitle="Like, comment, follow, turne…"
        badge={notificationsCount}
        onPress={() => navigation.navigate('Notifications')}
      />
      <MenuButton
        title="Messages"
        subtitle="Biseda private (edhe nga tab Chats)"
        badge={messagesCount}
        onPress={() => {
          const tabs = navigation.getParent?.();
          if (tabs?.navigate) {
            tabs.navigate('Messages', { screen: 'MessagingHome' });
          }
        }}
      />

      <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Module</Text>
      <MenuButton title="Wallet" subtitle="JonCoin balance and transactions" onPress={() => navigation.navigate('Wallet')} />
      {canUseInsights ? (
        <MenuButton
          title="Insights"
          subtitle="Analitika e profilit, XP dhe arritje"
          onPress={() => navigation.navigate('Insights')}
        />
      ) : null}
      <MenuButton title="Tournaments" subtitle="Trending and join flow" onPress={() => navigation.navigate('Tournaments')} />
      <MenuButton title="Videos" subtitle="Trending uploads and likes" onPress={() => navigation.navigate('Videos')} />
      {canUseScouting ? (
        <MenuButton title="Scouting" subtitle="Recommendations and filters" onPress={() => navigation.navigate('Scouting')} />
      ) : null}
      <MenuButton title="Search" subtitle="Users, posts and discovery" onPress={() => navigation.navigate('Search')} />
      <MenuButton title="Matches" subtitle="View and schedule matches" onPress={() => navigation.navigate('Matches')} />
      <MenuButton
        title="Streams & Go Live"
        subtitle="Live, regjistrime, ngarkim video"
        onPress={() => navigation.navigate('GoLive')}
      />
      <MenuButton title="Premium" subtitle="Membership plans and perks" onPress={() => navigation.navigate('Premium')} />
      <MenuButton title="Sponsors" subtitle="Create and view sponsor deals" onPress={() => navigation.navigate('Sponsors')} />
      <MenuButton title="Ads" subtitle="Create and view active ads" onPress={() => navigation.navigate('Ads')} />
      <MenuButton title="Settings" subtitle="Profile and app preferences" onPress={() => navigation.navigate('Settings')} />
      {canUseParentVerification ? (
        <MenuButton
          title="Parent Verification"
          subtitle="Send parent verification email"
          onPress={() => navigation.navigate('ParentVerification')}
        />
      ) : null}
      {isClub ? (
        <MenuButton title="Club Roster" subtitle="Manage requests and squad" onPress={() => navigation.navigate('ClubRoster')} />
      ) : null}
      {isAdmin ? (
        <MenuButton title="Admin Dashboard" subtitle="Users and platform analytics" onPress={() => navigation.navigate('AdminDashboard')} />
      ) : null}

      {!canUseScouting ? (
        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>Scouting Access</Text>
          <Text style={styles.noteText}>Scouting features are available for scout or club roles.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 30 },
  headerCard: {
    backgroundColor: '#ecfeff',
    borderWidth: 1,
    borderColor: '#a5f3fc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  headerTitle: { color: '#0f172a', fontWeight: '800', fontSize: 20 },
  headerSubtitle: { marginTop: 4, color: '#155e75' },
  alertBanner: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  alertText: { color: '#92400e', fontWeight: '600', marginBottom: 4 },
  sectionLabel: {
    color: '#64748b',
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  menuButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center' },
  menuTextCol: { flex: 1, paddingRight: 8 },
  menuTitle: { color: '#0f172a', fontWeight: '800' },
  menuSubtitle: { color: '#475569', marginTop: 4 },
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
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  noteTitle: { color: '#9a3412', fontWeight: '700' },
  noteText: { color: '#9a3412', marginTop: 4 },
});
