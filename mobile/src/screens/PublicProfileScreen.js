import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  addTransferHistoryRequest,
  clubMembersByClubRequest,
  clubRosterByClubRequest,
  clubStaffAssignmentsRequest,
  clubStaffByClubRequest,
  deleteTransferHistoryRequest,
  extractErrorMessage,
  followStatusRequest,
  gamificationAchievementsRequest,
  joncoinBalanceRequest,
  followUserRequest,
  getOrCreateConversationRequest,
  profileByIdRequest,
  sponsorsByUserRequest,
  transferHistoryByUserRequest,
  unfollowUserRequest,
  userGalleryRequest,
  userPostsRequest,
  userVideosRequest,
} from '../api/client';
import PublicProfileAchievementsTab from '../components/publicProfile/PublicProfileAchievementsTab';
import PublicProfileAboutTab from '../components/publicProfile/PublicProfileAboutTab';
import PublicProfileMatchHistoryTab from '../components/publicProfile/PublicProfileMatchHistoryTab';
import PublicProfileContactTab from '../components/publicProfile/PublicProfileContactTab';
import PublicProfileGalleryTab from '../components/publicProfile/PublicProfileGalleryTab';
import PublicProfileOverviewTab from '../components/publicProfile/PublicProfileOverviewTab';
import PublicProfilePostsTab from '../components/publicProfile/PublicProfilePostsTab';
import PublicProfileSponsorsTab from '../components/publicProfile/PublicProfileSponsorsTab';
import PublicProfileTabBar from '../components/publicProfile/PublicProfileTabBar';
import PublicProfileVideosTab from '../components/publicProfile/PublicProfileVideosTab';
import { useAuth } from '../context/AuthContext';
import { APP_BRAND_NAME } from '../config/branding';

const COVER_HEIGHT = 168;
const AVATAR_SIZE = 96;

function roleLabel(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'trajner') return 'Coach';
  if (!r) return '';
  return r.charAt(0).toUpperCase() + r.slice(1);
}

export default function PublicProfileScreen({ route, navigation }) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();
  const { user: me } = useAuth();

  const [profile, setProfile] = useState(null);
  const [postCount, setPostCount] = useState(0);
  const [posts, setPosts] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [videos, setVideos] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [staffAssignments, setStaffAssignments] = useState([]);
  const [clubMembers, setClubMembers] = useState([]);
  const [clubStaff, setClubStaff] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [joncoinBalance, setJoncoinBalance] = useState(null);
  const [platformAchievements, setPlatformAchievements] = useState([]);
  /** Profile tab key (avoid name `activeTab` — clashes with some tooling / stale bundles). */
  const [profileTab, setProfileTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Full-screen preview for cover or profile photo */
  const [headerImagePreview, setHeaderImagePreview] = useState(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferForm, setTransferForm] = useState({
    fromClub: '',
    toClub: '',
    position: '',
    season: '',
    transferDate: '',
    notes: '',
  });

  const userId = useMemo(() => {
    const p = route.params || {};
    const raw = p.userId ?? p.id;
    if (raw != null && raw !== '') return raw;
    return me?.id ?? null;
  }, [route.params, me?.id]);

  const isSelf = me?.id != null && userId != null && String(me.id) === String(userId);
  const ownProfileRoot = route.params?.ownProfile === true;

  useEffect(() => {
    setProfileTab(isSelf ? 'overview' : 'posts');
  }, [userId, isSelf]);

  const isAthlete = useMemo(() => {
    const r = String(profile?.role || '').toLowerCase();
    return r === 'athlete';
  }, [profile?.role]);

  useEffect(() => {
    if (!isSelf && profileTab === 'sponsors') {
      setProfileTab('posts');
    }
  }, [isSelf, profileTab]);

  useEffect(() => {
    if (!isAthlete && (profileTab === 'matches' || profileTab === 'achievements')) {
      setProfileTab('overview');
    }
  }, [isAthlete, profileTab]);

  const displayName = useMemo(() => {
    if (!profile) return APP_BRAND_NAME;
    const n = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
    return n || 'User';
  }, [profile]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: ownProfileRoot && !profile ? 'My Profile' : displayName,
      headerTitle: ownProfileRoot && !profile ? 'My Profile' : displayName,
    });
  }, [navigation, displayName, ownProfileRoot, profile]);

  const loadProfile = useCallback(
    async ({ silent } = { silent: false }) => {
      if (!silent) setLoading(true);
      setError('');
      try {
        const profileRes = await profileByIdRequest(userId);
        const p = profileRes.data || null;
        setProfile(p);
        const role = String(p?.role || '').toLowerCase();

        const clubId = p?.id ?? p?.userId ?? userId;
        const [
          followRes,
          postsRes,
          galleryRes,
          videosRes,
          transferRes,
          staffRes,
          sponsorsRes,
          membersRes,
          clubStaffRes,
          rosterRes,
          balanceRes,
          gamificationRes,
        ] = await Promise.all([
          isSelf ? Promise.resolve({ data: {} }) : followStatusRequest(userId),
          userPostsRequest(userId).catch(() => ({ data: [] })),
          userGalleryRequest(userId).catch(() => ({ data: [] })),
          userVideosRequest(userId).catch(() => ({ data: [] })),
          role === 'athlete' || role === 'coach' || role === 'trajner'
            ? transferHistoryByUserRequest(userId).catch(() => ({ data: [] }))
            : Promise.resolve({ data: [] }),
          role === 'coach' || role === 'trajner'
            ? clubStaffAssignmentsRequest(userId).catch(() => ({ data: [] }))
            : Promise.resolve({ data: [] }),
          isSelf ? sponsorsByUserRequest(userId).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          role === 'club'
            ? clubMembersByClubRequest(clubId, 'approved').catch(() => ({ data: [] }))
            : Promise.resolve({ data: [] }),
          role === 'club'
            ? clubStaffByClubRequest(clubId, { status: 'active' }).catch(() => ({ data: [] }))
            : Promise.resolve({ data: [] }),
          role === 'club'
            ? clubRosterByClubRequest(clubId).catch(() => ({ data: [] }))
            : Promise.resolve({ data: [] }),
          isSelf ? joncoinBalanceRequest().catch(() => ({ data: {} })) : Promise.resolve({ data: {} }),
          isSelf && role === 'athlete'
            ? gamificationAchievementsRequest().catch(() => ({ data: [] }))
            : Promise.resolve({ data: [] }),
        ]);

        if (!isSelf) {
          setFollowing(!!(followRes?.data?.isFollowing || followRes?.data?.following));
        }
        const postsData = Array.isArray(postsRes?.data) ? postsRes.data : [];
        setPosts(postsData);
        setPostCount(postsData.length);
        setGallery(Array.isArray(galleryRes?.data) ? galleryRes.data : []);
        setVideos(Array.isArray(videosRes?.data) ? videosRes.data : []);
        setTransfers(Array.isArray(transferRes?.data) ? transferRes.data : []);
        setStaffAssignments(Array.isArray(staffRes?.data) ? staffRes.data : []);
        setSponsors(Array.isArray(sponsorsRes?.data) ? sponsorsRes.data : []);

        if (isSelf) {
          const fromProfile = p?.joncoinBalance;
          const fromApi = balanceRes?.data?.balance;
          const n =
            fromProfile != null && fromProfile !== ''
              ? Number(fromProfile)
              : fromApi != null && fromApi !== ''
                ? Number(fromApi)
                : null;
          setJoncoinBalance(Number.isFinite(n) ? n : 0);
        } else {
          setJoncoinBalance(null);
        }

        if (isSelf && role === 'athlete') {
          setPlatformAchievements(Array.isArray(gamificationRes?.data) ? gamificationRes.data : []);
        } else {
          setPlatformAchievements([]);
        }

        if (role === 'club') {
          let members = Array.isArray(membersRes?.data) ? membersRes.data : [];
          if (members.length === 0) {
            const roster = Array.isArray(rosterRes?.data) ? rosterRes.data : [];
            members = roster.filter((r) => !r.status || r.status === 'approved');
          }
          setClubMembers(members);
          setClubStaff(Array.isArray(clubStaffRes?.data) ? clubStaffRes.data : []);
        } else {
          setClubMembers([]);
          setClubStaff([]);
        }
      } catch (err) {
        setError(extractErrorMessage(err, 'Failed to load profile'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId, isSelf]
  );

  useFocusEffect(
    useCallback(() => {
      if (userId == null || userId === '') {
        setError('Missing user');
        setLoading(false);
        return;
      }
      loadProfile();
    }, [loadProfile, userId])
  );

  const onAddTransfer = () => {
    setTransferForm({
      fromClub: '',
      toClub: '',
      position: profile?.position || '',
      season: '',
      transferDate: '',
      notes: '',
    });
    setTransferModalOpen(true);
  };

  const onSaveTransfer = async () => {
    if (!transferForm.toClub.trim()) {
      Alert.alert('Validation', 'Destination club is required.');
      return;
    }
    setTransferSaving(true);
    try {
      await addTransferHistoryRequest({
        transferType: 'player_transfer',
        fromClub: transferForm.fromClub.trim(),
        toClub: transferForm.toClub.trim(),
        position: transferForm.position.trim(),
        season: transferForm.season.trim(),
        transferDate: transferForm.transferDate.trim() || undefined,
        notes: transferForm.notes.trim(),
      });
      setTransferModalOpen(false);
      await loadProfile({ silent: true });
    } catch (err) {
      Alert.alert('Error', extractErrorMessage(err, 'Could not add transfer'));
    } finally {
      setTransferSaving(false);
    }
  };

  const onDeleteTransfer = (transfer) => {
    Alert.alert('Delete transfer', 'Remove this transfer record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTransferHistoryRequest(transfer.id);
            await loadProfile({ silent: true });
          } catch (err) {
            Alert.alert('Error', extractErrorMessage(err, 'Could not delete transfer'));
          }
        },
      },
    ]);
  };

  const onToggleFollow = async () => {
    if (busy || isSelf) return;
    setBusy(true);
    try {
      if (following) {
        await unfollowUserRequest(userId);
        setFollowing(false);
      } else {
        await followUserRequest(userId);
        setFollowing(true);
      }
      await loadProfile({ silent: true });
    } catch (err) {
      Alert.alert('Follow', extractErrorMessage(err, 'Could not update follow status'));
    } finally {
      setBusy(false);
    }
  };

  const onSendMessage = async () => {
    try {
      const res = await getOrCreateConversationRequest(userId);
      const conversationId = res?.data?.id;
      if (!conversationId) throw new Error('Conversation could not be created');
      const parent = navigation.getParent?.();
      const convParams = {
        conversationId,
        otherUserId: userId,
        isGroup: false,
      };
      if (parent?.navigate) {
        parent.navigate('Messages', { screen: 'Conversation', params: convParams });
      } else {
        navigation.navigate('Messages', { screen: 'Conversation', params: convParams });
      }
    } catch (err) {
      Alert.alert('Message', extractErrorMessage(err, 'Could not open conversation'));
    }
  };

  const onVideoCall = () => {
    navigation.navigate('OutgoingCall', { targetUserId: userId, audioOnly: false });
  };

  const openSocial = (baseUrl, handle) => {
    if (!handle) return;
    const h = String(handle).replace(/^@/, '');
    Linking.openURL(`${baseUrl}${encodeURIComponent(h)}`).catch(() => {});
  };

  const theme = useMemo(
    () => ({
      isDark,
      bg: isDark ? '#020617' : '#f1f5f9',
      card: isDark ? '#0f172a' : '#ffffff',
      border: isDark ? '#1e293b' : '#e2e8f0',
      text: isDark ? '#f8fafc' : '#0f172a',
      muted: isDark ? '#94a3b8' : '#64748b',
      chipBg: isDark ? '#1e293b' : '#f1f5f9',
      chipText: isDark ? '#e2e8f0' : '#334155',
      coverFallback: isDark ? ['#1e3a8a', '#5b21b6'] : ['#3b82f6', '#7c3aed'],
    }),
    [isDark]
  );

  const tabs = useMemo(() => {
    const base = [
      { key: 'overview', label: '🏠 Overview' },
      { key: 'posts', label: '📝 Posts' },
    ];
    if (isAthlete) {
      base.push({ key: 'matches', label: '⚽ Matches' });
      base.push({ key: 'achievements', label: '🏆 Achievements' });
    }
    base.push(
      { key: 'gallery', label: '🖼️ Gallery' },
      { key: 'videos', label: '🎥 Videos' },
      { key: 'about', label: 'ℹ️ About' },
      { key: 'contact', label: '✉️ Contact' }
    );
    if (isSelf) base.push({ key: 'sponsors', label: '🤝 Sponsors' });
    return base;
  }, [isSelf, isAthlete]);

  const onOpenInsights = useCallback(() => {
    const parent = navigation.getParent?.();
    if (parent?.navigate) {
      parent.navigate('More', { screen: 'Insights' });
    }
  }, [navigation]);

  const onGoLive = useCallback(() => {
    if (navigation.navigate) {
      navigation.navigate('GoLive');
      return;
    }
    const parent = navigation.getParent?.();
    if (parent?.navigate) {
      parent.navigate('More', { screen: 'GoLive' });
    }
  }, [navigation]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  if (error && !profile) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.bg, padding: 24 }]}>
        <Text style={[styles.error, { color: '#f87171' }]}>{error}</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.bg }]}>
        <Text style={{ color: theme.muted }}>Profile not found</Text>
      </View>
    );
  }

  const initials = `${(profile.firstName || 'U').charAt(0)}${(profile.lastName || '').charAt(0)}`.toUpperCase();
  const coverUri = profile.coverPhoto && typeof profile.coverPhoto === 'string' ? profile.coverPhoto : null;
  const photoUri = profile.profilePhoto && typeof profile.profilePhoto === 'string' ? profile.profilePhoto : null;
  const stats = profile.stats && typeof profile.stats === 'object' ? profile.stats : {};
  const contact = profile.contact && typeof profile.contact === 'object' ? profile.contact : {};

  const bioSnippet =
    profile.bio && profile.bio.length > 120 ? `${profile.bio.slice(0, 120)}…` : profile.bio;

  const Chip = ({ icon, children }) =>
    children ? (
      <View style={[styles.chip, { backgroundColor: theme.chipBg }]}>
        {icon ? <Ionicons name={icon} size={14} color={theme.chipText} style={{ marginRight: 4 }} /> : null}
        <Text style={[styles.chipText, { color: theme.chipText }]} numberOfLines={2}>
          {children}
        </Text>
      </View>
    ) : null;

  const closeHeaderPreview = () => setHeaderImagePreview(null);

  return (
    <>
    <ScrollView
      style={[styles.root, { backgroundColor: theme.bg }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadProfile({ silent: true });
          }}
          colors={['#0f766e']}
        />
      }
    >
      <View style={{ paddingTop: insets.top ? 0 : 0 }}>
        {coverUri ? (
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => setHeaderImagePreview(coverUri)}
            accessibilityRole="imagebutton"
            accessibilityLabel="View cover photo"
          >
            <ImageBackground source={{ uri: coverUri }} style={styles.cover} imageStyle={styles.coverImage}>
              <View style={styles.coverTint} />
            </ImageBackground>
          </TouchableOpacity>
        ) : (
          <View
            style={[
              styles.cover,
              { backgroundColor: theme.coverFallback[0] },
            ]}
          />
        )}

        <View style={[styles.headerBlock, { marginTop: -AVATAR_SIZE / 2 }]}>
          <View style={styles.avatarWrap}>
            <TouchableOpacity
              activeOpacity={photoUri ? 0.88 : 1}
              disabled={!photoUri}
              onPress={() => photoUri && setHeaderImagePreview(photoUri)}
              accessibilityRole={photoUri ? 'imagebutton' : 'none'}
              accessibilityLabel={photoUri ? 'View profile photo' : undefined}
            >
            <View
              style={[
                styles.avatarRing,
                { borderColor: theme.card, backgroundColor: theme.card },
              ]}
            >
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: '#0f766e' }]}>
                  <Text style={styles.avatarFallbackText}>{initials}</Text>
                </View>
              )}
            </View>
            </TouchableOpacity>
            {profile.verified ? (
              <View style={[styles.verifiedBadge, { backgroundColor: theme.card }]}>
                <Ionicons name="checkmark-circle" size={26} color="#2563eb" />
              </View>
            ) : null}
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                shadowColor: '#000',
              },
            ]}
          >
            <Text style={[styles.name, { color: theme.text }]}>{displayName}</Text>
            <Text style={styles.roleLine}>{roleLabel(profile.role)}</Text>

            {profile.bio ? (
              <Text style={[styles.bio, { color: theme.muted }]}>{bioSnippet}</Text>
            ) : null}

            <View style={styles.chipRow}>
              {profile.age != null && profile.ageGroup ? (
                <Chip icon="calendar-outline">
                  {profile.age} yrs ({profile.ageGroup})
                </Chip>
              ) : null}
              {profile.position ? <Chip icon="football-outline">{profile.position}</Chip> : null}
              {profile.club ? <Chip icon="business-outline">{profile.club}</Chip> : null}
              {stats.jerseyNumber != null && String(stats.jerseyNumber) !== '' ? (
                <Chip icon="shirt-outline">#{stats.jerseyNumber}</Chip>
              ) : null}
              {profile.city || profile.country ? (
                <Chip icon="location-outline">
                  {[profile.city, profile.country].filter(Boolean).join(', ')}
                </Chip>
              ) : null}
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCell}>
                <Text style={[styles.statNum, { color: theme.text }]}>{postCount}</Text>
                <Text style={[styles.statLabel, { color: theme.muted }]}>Posts</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={[styles.statNum, { color: theme.text }]}>{profile.followers ?? 0}</Text>
                <Text style={[styles.statLabel, { color: theme.muted }]}>Followers</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={[styles.statNum, { color: theme.text }]}>{profile.following ?? 0}</Text>
                <Text style={[styles.statLabel, { color: theme.muted }]}>Following</Text>
              </View>
            </View>

            {(contact.instagram || contact.twitter || contact.facebook) && !isSelf ? (
              <View style={styles.socialRow}>
                {contact.instagram ? (
                  <TouchableOpacity
                    style={[styles.socialBtn, { backgroundColor: '#c026d3' }]}
                    onPress={() => openSocial('https://instagram.com/', contact.instagram)}
                  >
                    <Ionicons name="logo-instagram" size={20} color="#fff" />
                  </TouchableOpacity>
                ) : null}
                {contact.twitter ? (
                  <TouchableOpacity
                    style={[styles.socialBtn, { backgroundColor: '#1d9bf0' }]}
                    onPress={() => openSocial('https://twitter.com/', contact.twitter)}
                  >
                    <Ionicons name="logo-twitter" size={20} color="#fff" />
                  </TouchableOpacity>
                ) : null}
                {contact.facebook ? (
                  <TouchableOpacity
                    style={[styles.socialBtn, { backgroundColor: '#1877f2' }]}
                    onPress={() => Linking.openURL(`https://facebook.com/${String(contact.facebook).replace(/^\//, '')}`)}
                  >
                    <Ionicons name="logo-facebook" size={20} color="#fff" />
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {!isSelf ? (
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[
                    styles.followBtn,
                    following && {
                      backgroundColor: 'transparent',
                      borderWidth: 2,
                      borderColor: isDark ? '#475569' : '#cbd5e1',
                    },
                  ]}
                  onPress={onToggleFollow}
                  disabled={busy}
                >
                  <Text
                    style={[
                      styles.followBtnText,
                      following && { color: theme.muted },
                    ]}
                  >
                    {busy ? '…' : following ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.msgBtn,
                    { backgroundColor: isDark ? '#334155' : '#e2e8f0' },
                  ]}
                  onPress={onSendMessage}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.text} />
                  <Text style={[styles.msgBtnText, { color: theme.text }]}>Message</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.videoBtn} onPress={onVideoCall}>
                  <Ionicons name="videocam-outline" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.selfActionsWrap}>
                {joncoinBalance != null ? (
                  <View style={[styles.joncoinBanner, { borderColor: theme.border, backgroundColor: theme.chipBg }]}>
                    <Text style={styles.joncoinLabel}>JonCoin</Text>
                    <Text style={styles.joncoinValue}>{joncoinBalance}</Text>
                  </View>
                ) : null}
                <TouchableOpacity style={styles.goLiveBtn} onPress={onGoLive} activeOpacity={0.88}>
                  <Ionicons name="videocam" size={20} color="#fff" />
                  <Text style={styles.goLiveBtnText}>Go Live</Text>
                </TouchableOpacity>
                <View style={styles.selfActionsRow}>
                  <TouchableOpacity
                    style={styles.selfPrimaryBtn}
                    onPress={() => navigation.navigate('EditProfile')}
                  >
                    <Ionicons name="create-outline" size={18} color="#fff" />
                    <Text style={styles.selfPrimaryBtnText}>Edit profile</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.selfSecondaryBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
                    onPress={() => navigation.navigate('BrowseProfiles')}
                  >
                    <Ionicons name="people-outline" size={18} color="#0f766e" />
                    <Text style={styles.selfSecondaryBtnText}>Browse</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <PublicProfileTabBar tabs={tabs} activeKey={profileTab} onChange={setProfileTab} theme={theme} />
            <View style={styles.tabPanel}>
              {profileTab === 'overview' ? (
                <PublicProfileOverviewTab
                  profile={profile}
                  theme={theme}
                  staffAssignments={staffAssignments}
                  clubMembers={clubMembers}
                  clubStaff={clubStaff}
                  onPressUser={(uid) => navigation.push('PublicProfile', { userId: uid })}
                />
              ) : null}
              {profileTab === 'posts' ? <PublicProfilePostsTab posts={posts} theme={theme} /> : null}
              {profileTab === 'matches' && isAthlete ? (
                <PublicProfileMatchHistoryTab profile={profile} theme={theme} />
              ) : null}
              {profileTab === 'achievements' && isAthlete ? (
                <PublicProfileAchievementsTab
                  profile={profile}
                  theme={theme}
                  platformAchievements={platformAchievements}
                  isSelf={isSelf}
                  onOpenInsights={isSelf ? onOpenInsights : undefined}
                />
              ) : null}
              {profileTab === 'gallery' ? <PublicProfileGalleryTab items={gallery} theme={theme} /> : null}
              {profileTab === 'videos' ? (
                <PublicProfileVideosTab
                  videos={videos}
                  liveVideos={Array.isArray(profile?.liveVideos) ? profile.liveVideos : []}
                  theme={theme}
                />
              ) : null}
              {profileTab === 'about' ? (
                <PublicProfileAboutTab
                  profile={profile}
                  transfers={transfers}
                  theme={theme}
                  isOwner={isSelf}
                  onAddTransfer={onAddTransfer}
                  onDeleteTransfer={onDeleteTransfer}
                />
              ) : null}
              {profileTab === 'contact' ? <PublicProfileContactTab profile={profile} theme={theme} /> : null}
              {profileTab === 'sponsors' && isSelf ? (
                <PublicProfileSponsorsTab sponsors={sponsors} theme={theme} />
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </ScrollView>

    <Modal visible={transferModalOpen} transparent animationType="slide" onRequestClose={() => setTransferModalOpen(false)}>
      <View style={styles.transferModalBackdrop}>
        <View style={[styles.transferModalCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.transferModalTitle, { color: theme.text }]}>Add transfer</Text>
          <TextInput
            style={styles.transferInput}
            placeholder="From club"
            placeholderTextColor="#94a3b8"
            value={transferForm.fromClub}
            onChangeText={(v) => setTransferForm((f) => ({ ...f, fromClub: v }))}
          />
          <TextInput
            style={styles.transferInput}
            placeholder="To club *"
            placeholderTextColor="#94a3b8"
            value={transferForm.toClub}
            onChangeText={(v) => setTransferForm((f) => ({ ...f, toClub: v }))}
          />
          <TextInput
            style={styles.transferInput}
            placeholder="Position"
            placeholderTextColor="#94a3b8"
            value={transferForm.position}
            onChangeText={(v) => setTransferForm((f) => ({ ...f, position: v }))}
          />
          <TextInput
            style={styles.transferInput}
            placeholder="Season"
            placeholderTextColor="#94a3b8"
            value={transferForm.season}
            onChangeText={(v) => setTransferForm((f) => ({ ...f, season: v }))}
          />
          <TextInput
            style={styles.transferInput}
            placeholder="Date (YYYY-MM-DD)"
            placeholderTextColor="#94a3b8"
            value={transferForm.transferDate}
            onChangeText={(v) => setTransferForm((f) => ({ ...f, transferDate: v }))}
          />
          <TextInput
            style={[styles.transferInput, { minHeight: 64 }]}
            placeholder="Notes"
            placeholderTextColor="#94a3b8"
            value={transferForm.notes}
            onChangeText={(v) => setTransferForm((f) => ({ ...f, notes: v }))}
            multiline
          />
          <View style={styles.transferModalActions}>
            <TouchableOpacity style={styles.transferCancelBtn} onPress={() => setTransferModalOpen(false)}>
              <Text style={styles.transferCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.transferSaveBtn} onPress={onSaveTransfer} disabled={transferSaving}>
              <Text style={styles.transferSaveText}>{transferSaving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    <Modal visible={!!headerImagePreview} transparent animationType="fade" onRequestClose={closeHeaderPreview}>
      <View style={styles.previewModalRoot}>
        <Pressable style={styles.previewModalBackdrop} onPress={closeHeaderPreview} accessibilityLabel="Close preview" />
        <View style={styles.previewModalLayer} pointerEvents="box-none">
          <Pressable
            onPress={closeHeaderPreview}
            style={[
              styles.previewModalClose,
              { top: insets.top + 10, right: Math.max(insets.right, 12) + 4 },
            ]}
            hitSlop={16}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <View style={styles.previewModalCloseInner}>
              <Ionicons name="close" size={28} color="#fff" />
            </View>
          </Pressable>
          {headerImagePreview ? (
            <View style={styles.previewModalImgWrap} pointerEvents="auto">
              <Image source={{ uri: headerImagePreview }} style={styles.previewModalImg} resizeMode="contain" />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cover: {
    width: '100%',
    height: COVER_HEIGHT,
  },
  coverImage: { resizeMode: 'cover' },
  coverTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.12)' },
  headerBlock: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  avatarWrap: {
    marginBottom: 8,
    position: 'relative',
  },
  avatarRing: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 4,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  verifiedBadge: {
    position: 'absolute',
    right: -4,
    bottom: 4,
    borderRadius: 20,
  },
  card: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  name: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  roleLine: {
    marginTop: 4,
    textAlign: 'center',
    color: '#0f766e',
    fontWeight: '700',
    fontSize: 15,
  },
  bio: { marginTop: 10, textAlign: 'center', lineHeight: 22, fontSize: 15 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: '100%',
  },
  chipText: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 22,
    paddingHorizontal: 8,
  },
  statCell: { alignItems: 'center', minWidth: 72 },
  statNum: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
  },
  socialBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 18,
    flexWrap: 'wrap',
  },
  followBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 10,
    minWidth: 108,
    alignItems: 'center',
  },
  followBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  msgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  msgBtnText: { fontWeight: '700', fontSize: 15 },
  videoBtn: {
    backgroundColor: '#16a34a',
    width: 46,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfActionsWrap: { marginTop: 16, width: '100%' },
  goLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 10,
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
  },
  goLiveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  joncoinBanner: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    alignItems: 'center',
  },
  joncoinLabel: { color: '#92400e', fontWeight: '700', fontSize: 12 },
  joncoinValue: { color: '#b45309', fontWeight: '800', fontSize: 22, marginTop: 2 },
  selfActionsRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  selfPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0f766e',
    paddingVertical: 12,
    borderRadius: 10,
    maxWidth: 200,
  },
  selfPrimaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  selfSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: '#0f766e',
    paddingVertical: 10,
    borderRadius: 10,
    maxWidth: 140,
  },
  selfSecondaryBtnText: { color: '#0f766e', fontWeight: '800', fontSize: 15 },
  tabPanel: {
    marginTop: 8,
    paddingTop: 4,
    paddingBottom: 8,
  },
  error: { textAlign: 'center' },
  previewModalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  previewModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  previewModalLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  previewModalClose: {
    position: 'absolute',
    zIndex: 20,
    elevation: 20,
  },
  previewModalCloseInner: {
    padding: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  previewModalImgWrap: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    minHeight: 200,
  },
  previewModalImg: {
    width: '100%',
    height: '80%',
  },
  transferModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  transferModalCard: { borderRadius: 12, padding: 16 },
  transferModalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  transferInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    color: '#0f172a',
  },
  transferModalActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  transferCancelBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1' },
  transferCancelText: { color: '#475569', fontWeight: '700' },
  transferSaveBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: '#0f766e' },
  transferSaveText: { color: '#fff', fontWeight: '700' },
});
