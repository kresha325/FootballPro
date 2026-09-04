import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

function MenuButton({ title, subtitle, onPress }) {
  return (
    <TouchableOpacity style={styles.menuButton} onPress={onPress}>
      <Text style={styles.menuTitle}>{title}</Text>
      {subtitle ? <Text style={styles.menuSubtitle}>{subtitle}</Text> : null}
    </TouchableOpacity>
  );
}

export default function MoreScreen({ navigation }) {
  const { user } = useAuth();
  const canUseScouting = user?.role === 'scout' || user?.role === 'club';
  const canUseInsights = ['athlete', 'coach', 'club', 'scout', 'manager', 'business', 'federation', 'admin'].includes(user?.role);
  const isAdmin = user?.role === 'admin';
  const isClub = user?.role === 'club';
  const canUseParentVerification = user?.role === 'athlete';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>More</Text>
        <Text style={styles.headerSubtitle}>Extra modules and tools</Text>
      </View>

      <MenuButton title="Wallet" subtitle="JonCoin balance and transactions" onPress={() => navigation.navigate('Wallet')} />
      <MenuButton title="🏆 Achievements & Badges" subtitle="Track your gamification progress" onPress={() => navigation.navigate('Gamification')} />
      {canUseInsights ? <MenuButton title="Insights" subtitle="Analytics and gamification" onPress={() => navigation.navigate('Insights')} /> : null}
      <MenuButton title="Tournaments" subtitle="Trending and join flow" onPress={() => navigation.navigate('Tournaments')} />
      {canUseScouting ? <MenuButton title="Scouting" subtitle="Recommendations and filters" onPress={() => navigation.navigate('Scouting')} /> : null}
      <MenuButton title="Notifications" subtitle="Your latest updates" onPress={() => navigation.navigate('Notifications')} />
      <MenuButton title="Search" subtitle="Users, posts and discovery" onPress={() => navigation.navigate('Search')} />
      <MenuButton title="Matches" subtitle="View and schedule matches" onPress={() => navigation.navigate('Matches')} />
      <MenuButton title="Go Live" subtitle="Start a live session" onPress={() => navigation.navigate('GoLive')} />
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
  menuButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  menuTitle: { color: '#0f172a', fontWeight: '800' },
  menuSubtitle: { color: '#475569', marginTop: 4 },
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
