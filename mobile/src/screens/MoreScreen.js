import React, { useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from '../theme/nativeComponents';
import { useAuth, useSocket } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useUnreadBadges } from '../hooks/useUnreadBadges';
import { hasTier, getEffectiveTier, tierLabel } from '../utils/subscriptionAccess';
import { useRenderLog } from '../utils/perfLog';
import { useLocale } from '../context/LocaleContext';
import { usePlatform } from '../context/PlatformContext';

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
  useRenderLog('MoreScreen');
  const { user, logout } = useAuth();
  const { getSocket, socketConnected } = useSocket();
  const { colors } = useTheme();
  const { t } = useLocale();
  const { isEnabled } = usePlatform();
  const { notificationsCount, messagesCount } = useUnreadBadges(getSocket, socketConnected);

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

  const canUseScouting = user?.role === 'scout' || user?.role === 'club' || user?.role === 'manager';
  const hasScoutingPlan = hasTier(user, 'pro');
  const canUseInsights = ['athlete', 'coach', 'club', 'scout', 'manager', 'business', 'federation', 'admin'].includes(
    user?.role
  );
  const isAdmin = user?.role === 'admin';
  const isClub = user?.role === 'club';
  const isCoach = user?.role === 'coach';
  const canUseParentVerification = user?.role === 'athlete';
  const planName = tierLabel(getEffectiveTier(user));

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
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('More')}</Text>
        <Text style={[styles.headerSubtitle, { color: colors.primaryText }]}>
          {t('Plan')}: {planName}
          {user?.inTrial ? ' · trial' : ''}
        </Text>
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

      <Text style={[styles.sectionLabel, { color: colors.muted }]}>{t('Notifications & messages')}</Text>
      {btn({
        title: t('notifications'),
        subtitle: t('Likes, comments, follows, tournaments…'),
        badge: notificationsCount,
        onPress: () =>
          navigation.navigate({
            name: 'Notifications',
          }),
      })}
      {btn({
        title: t('messages'),
        subtitle: t('Private chats (also under Chats tab)'),
        badge: messagesCount,
        onPress: () => {
          const tabs = navigation.getParent?.();
          if (tabs?.navigate) {
            tabs.navigate('Messages', { screen: 'MessagingHome' });
          }
        },
      })}

      <Text style={[styles.sectionLabel, { color: colors.muted, marginTop: 8 }]}>{t('Modules')}</Text>
      {isEnabled('JONCOIN') ? btn({ title: t('Wallet'), subtitle: t('XCoin balance and transactions'), onPress: () => navigation.navigate('Wallet') }) : null}
      {isEnabled('ANALYTICS') ? btn({
        title: t('Performance'),
        subtitle: t('Statistics, form, sales and wallet'),
        onPress: () => navigation.navigate('Performance'),
      }) : null}
      {canUseInsights
        ? btn({
            title: t('Insights'),
            subtitle: hasTier(user, 'basic')
              ? t('Profile analytics, XP and achievements')
              : t('Analytics requires Basic/Pro · XP is free'),
            onPress: () => navigation.navigate('Insights'),
          })
        : null}
      {btn({ title: t('Tournaments'), subtitle: t('Trending tournaments and joining'), onPress: () => navigation.navigate('Tournaments') })}
      {btn({ title: t('Videos'), subtitle: t('Popular uploads and likes'), onPress: () => navigation.navigate('Videos') })}
      {canUseScouting && isEnabled('SCOUTING')
        ? btn({
            title: t('Scouting'),
            subtitle: hasScoutingPlan ? t('Discovery, shortlist, reports') : t('Requires the Pro plan'),
            onPress: () => navigation.navigate('Scouting'),
          })
        : null}
      {btn({ title: t('Search'), subtitle: t('Users, posts and discovery'), onPress: () => navigation.navigate('Search') })}
      {btn({ title: t('Matches'), subtitle: t('View and schedule matches'), onPress: () => navigation.navigate('Matches') })}
      {btn({ title: t('Calendar'), subtitle: t('Upcoming, today, and results'), onPress: () => navigation.navigate('Calendar') })}
      {isEnabled('LIVE_STREAMING') ? btn({
        title: t('Streams'),
        subtitle: t('Live now, recordings, Go Live'),
        onPress: () => navigation.navigate('Streams'),
      }) : null}
      {isEnabled('LIVE_STREAMING') ? btn({
        title: t('Go Live'),
        subtitle: t('Start a LiveKit / YouTube stream'),
        onPress: () => navigation.navigate('GoLive'),
      }) : null}
      {isEnabled('PREMIUM') ? btn({ title: t('Premium'), subtitle: t('Membership plans and perks'), onPress: () => navigation.navigate('Premium') }) : null}
      {btn({ title: t('Sponsors'), subtitle: t('Manage your sponsor deals'), onPress: () => navigation.navigate('Sponsors') })}
      {btn({ title: t('Ads'), subtitle: t('Create and view active ads'), onPress: () => navigation.navigate('Ads') })}
      {btn({ title: t('Settings'), subtitle: t('Profile and app preferences'), onPress: () => navigation.navigate('Settings') })}
      {btn({
        title: t('Help & FAQ'),
        subtitle: t('How the platform works'),
        onPress: () => navigation.navigate('Legal', { kind: 'help' }),
      })}
      {btn({
        title: t('Privacy & data'),
        subtitle: t('Privacy, terms and account deletion'),
        onPress: () => navigation.navigate('Legal', { kind: 'privacy' }),
      })}
      {btn({
        title: t('Log out'),
        subtitle: t('Logout'),
        onPress: () => {
          Alert.alert(t('Log out'), t('Do you want to log out?'), [
            { text: t('cancel'), style: 'cancel' },
            { text: t('logout'), style: 'destructive', onPress: () => logout() },
          ]);
        },
      })}
      {canUseParentVerification
        ? btn({
            title: t('Parent Verification'),
            subtitle: t('Send parent verification email'),
            onPress: () => navigation.navigate('ParentVerification'),
          })
        : null}
      {isClub || isCoach
        ? btn({
            title: t(isCoach ? 'Regjistro atlet' : 'Club Roster'),
            subtitle: t(isCoach ? 'Regjistro atlet për klubin tënd' : 'Manage requests and squad'),
            onPress: () => navigation.navigate('ClubRoster'),
          })
        : null}
      {isAdmin
        ? btn({
            title: t('Admin Dashboard'),
            subtitle: t('Users and platform analytics'),
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
          <Text style={[styles.noteTitle, { color: colors.warningText }]}>{t('Scouting Access')}</Text>
          <Text style={[styles.noteText, { color: colors.warningText }]}>
            {t('Scouting is for Scout, Club and Manager with the Pro plan.')}
          </Text>
        </View>
      ) : !hasScoutingPlan ? (
        <View
          style={[
            styles.noteCard,
            { backgroundColor: colors.warningSoft, borderColor: colors.warningBorder },
          ]}
        >
          <Text style={[styles.noteTitle, { color: colors.warningText }]}>{t('Pro plan')}</Text>
          <Text style={[styles.noteText, { color: colors.warningText }]}>
            {t('Scouting recommendations require Pro. Trial includes Basic analytics.')}
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
