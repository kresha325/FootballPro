import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
} from '../theme/nativeComponents';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { PROFILE_THEMES } from '../utils/profileThemes';
import {
  addTransferHistoryRequest,
  clubMembersByClubRequest,
  clubRosterByClubRequest,
  clubStaffAssignmentsRequest,
  clubStaffByClubRequest,
  confirmTransferHistoryRequest,
  deleteTransferHistoryRequest,
  extractErrorMessage,
  followStatusRequest,
  followersListRequest,
  followingListRequest,
  gamificationAchievementsRequest,
  joncoinBalanceRequest,
  followUserRequest,
  getOrCreateConversationRequest,
  profileByIdRequest,
  profileTournamentSummaryRequest,
  rejectTransferHistoryRequest,
  sponsorsByUserRequest,
  transferHistoryByUserRequest,
  transferHistoryPendingForClubRequest,
  unfollowUserRequest,
  userGalleryRequest,
  userPostsRequest,
  userVideosRequest,
  playerMediaRequest,
  clubMediaRequest,
  blockUserRequest,
  unblockUserRequest,
  blockStatusRequest,
} from '../api/client';
import ReportSheet from '../components/ReportSheet';
import PublicProfileTournamentsTab from '../components/publicProfile/PublicProfileTournamentsTab';
import { promptShareProfileCv } from '../utils/shareProfile';
import PublicProfileAchievementsTab from '../components/publicProfile/PublicProfileAchievementsTab';
import { getFoundingYear, isOrgProfileRole, publicProfileName } from '../utils/orgProfile';
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
import { openTournamentDetail, openUserProfile } from '../utils/openUserProfile';
import { APP_BRAND_NAME } from '../config/branding';
import NotificationHeaderButton from '../components/NotificationHeaderButton';
import { perfStart } from '../utils/perfLog';

const COVER_HEIGHT = 168;
const AVATAR_SIZE = 96;

function roleLabel(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'trajner') return 'Coach';
  if (!r) return '';
  return r.charAt(0).toUpperCase() + r.slice(1);
}

export default function PublicProfileScreen({ route, navigation }) {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user: me, logout } = useAuth();

  const [profile, setProfile] = useState(null);
  const [postCount, setPostCount] = useState(0);
  const [posts, setPosts] = useState([]);
  const [postsHasMore, setPostsHasMore] = useState(false);
  const [postsLoadingMore, setPostsLoadingMore] = useState(false);
  const postsPageRef = useRef(1);
  const [gallery, setGallery] = useState([]);
  const [videos, setVideos] = useState([]);
  const [youtubeMedia, setYoutubeMedia] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [clubPendingTransfers, setClubPendingTransfers] = useState([]);
  const [actionTransferId, setActionTransferId] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [iBlocked, setIBlocked] = useState(false);
  const [staffAssignments, setStaffAssignments] = useState([]);
  const [clubMembers, setClubMembers] = useState([]);
  const [clubStaff, setClubStaff] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [joncoinBalance, setJoncoinBalance] = useState(null);
  const [platformAchievements, setPlatformAchievements] = useState([]);
  const [tournamentSummary, setTournamentSummary] = useState({ tournaments: [], totals: null });
  /** Profile tab key (avoid name `activeTab` — clashes with some tooling / stale bundles). */
  const [profileTab, setProfileTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [sectionsReady, setSectionsReady] = useState({});
  const [sectionReload, setSectionReload] = useState(0);
  const coreAt = useRef({ id: '', ts: 0 });
  const sectionCache = useRef(new Map());
  const requestGen = useRef(0);
  const coreAbort = useRef(null);
  const appliedReload = useRef(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [followListMode, setFollowListMode] = useState(null); // 'followers' | 'following'
  const [followListRows, setFollowListRows] = useState([]);
  const [followListLoading, setFollowListLoading] = useState(false);
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
  const isClubViewer = String(me?.role || '').toLowerCase() === 'club';
  const myClubId = me?.id != null ? Number(me.id) : null;

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
    return publicProfileName(profile) || 'Përdorues';
  }, [profile]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: ownProfileRoot && !profile ? 'Profili im' : displayName,
      headerTitle: ownProfileRoot && !profile ? 'Profili im' : displayName,
      headerRight: profile && isSelf
        ? () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 4 }}>
              <NotificationHeaderButton />
              <TouchableOpacity
                onPress={() => promptShareProfileCv(profile, { navigation })}
                style={{ paddingHorizontal: 8 }}
                accessibilityLabel="CV dixhitale"
              >
                <Ionicons name="share-outline" size={22} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert('Dil', 'Dal nga llogaria?', [
                    { text: 'Anulo', style: 'cancel' },
                    { text: 'Dil', style: 'destructive', onPress: () => logout() },
                  ]);
                }}
                style={{ paddingHorizontal: 6 }}
                accessibilityLabel="Dil"
              >
                <View
                  style={{
                    backgroundColor: '#ef4444',
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Dil</Text>
                </View>
              </TouchableOpacity>
            </View>
          )
        : !isSelf && userId
          ? () => (
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(displayName || 'Profili', undefined, [
                    {
                      text: iBlocked ? 'Hiq bllokimin' : 'Blloko',
                      style: iBlocked ? 'default' : 'destructive',
                      onPress: async () => {
                        try {
                          if (iBlocked) {
                            await unblockUserRequest(userId);
                            setIBlocked(false);
                          } else {
                            await blockUserRequest(userId);
                            setIBlocked(true);
                            Alert.alert('U bllokua', 'Ky përdorues është bllokuar.');
                          }
                        } catch (err) {
                          Alert.alert('Gabim', extractErrorMessage(err, 'Nuk u përditësua bllokimi'));
                        }
                      },
                    },
                    { text: 'Raporto', onPress: () => setReportOpen(true) },
                    { text: 'Anulo', style: 'cancel' },
                  ]);
                }}
                style={{ paddingHorizontal: 12 }}
              >
                <Ionicons name="ellipsis-horizontal" size={22} color={colors.primary} />
              </TouchableOpacity>
            )
          : undefined,
    });
  }, [
    navigation,
    colors.primary,
    ownProfileRoot,
    profile,
    displayName,
    isSelf,
    userId,
    iBlocked,
    logout,
  ]);

  useEffect(() => {
    if (!userId || isSelf) {
      setIBlocked(false);
      return;
    }
    blockStatusRequest(userId)
      .then((res) => setIBlocked(!!res.data?.iBlocked))
      .catch(() => setIBlocked(false));
  }, [userId, isSelf]);

  useEffect(() => {
    setProfile(null);
    setPosts([]);
    setPostsHasMore(false);
    postsPageRef.current = 1;
    setGallery([]);
    setVideos([]);
    setYoutubeMedia([]);
    setTransfers([]);
    setClubPendingTransfers([]);
    setStaffAssignments([]);
    setClubMembers([]);
    setClubStaff([]);
    setSponsors([]);
    setPlatformAchievements([]);
    setTournamentSummary({ tournaments: [], totals: null });
    setSectionsReady({});
    setPostCount(0);
    sectionCache.current.clear();
    return () => {
      requestGen.current += 1;
      coreAbort.current?.abort();
    };
  }, [userId]);

  const loadCore = useCallback(async ({ silent } = {}) => {
    if (userId == null || userId === '') return null;
    const gen = requestGen.current;
    coreAbort.current?.abort();
    const controller = new AbortController();
    coreAbort.current = controller;
    if (!silent) setLoading(true);
    setError('');
    const done = perfStart('Profile core');
    const followPromise = isSelf ? null : followStatusRequest(userId).catch(() => null);
    const balancePromise = isSelf ? joncoinBalanceRequest().catch(() => null) : null;
    try {
      const profileRes = await profileByIdRequest(userId, { signal: controller.signal });
      if (gen !== requestGen.current || controller.signal.aborted) return null;
      const p = profileRes.data || null;
      setProfile(p);
      setPostCount(Number(p?.postsCount) || 0);
      coreAt.current = { id: String(userId), ts: Date.now() };
      if (isSelf) {
        const fromProfile = p?.joncoinBalance;
        const applyBalance = (fromApi) => {
          const n =
            fromProfile != null && fromProfile !== ''
              ? Number(fromProfile)
              : fromApi != null && fromApi !== ''
                ? Number(fromApi)
                : null;
          if (gen === requestGen.current) setJoncoinBalance(Number.isFinite(n) ? n : 0);
        };
        if (fromProfile != null && fromProfile !== '') applyBalance(null);
        else if (balancePromise) balancePromise.then((res) => applyBalance(res?.data?.balance));
        else applyBalance(null);
      } else {
        setJoncoinBalance(null);
        if (followPromise) {
          followPromise.then((followRes) => {
            if (gen !== requestGen.current || !followRes) return;
            setFollowing(!!(followRes?.data?.isFollowing || followRes?.data?.following));
          });
        }
      }
      return p;
    } catch (err) {
      if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return null;
      if (gen === requestGen.current) {
        setError(extractErrorMessage(err, 'Nuk u arrit ngarkimi i profilit'));
      }
      return null;
    } finally {
      done();
      if (gen === requestGen.current && !controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [isSelf, userId]);

  const loadSection = useCallback(async (section, profileSnapshot, { force } = {}) => {
    const gen = requestGen.current;
    const uid = userId;
    if (!uid || !section || !profileSnapshot) return;
    if (section === 'matches' || section === 'contact') {
      setSectionsReady((prev) => (prev[section] ? prev : { ...prev, [section]: true }));
      return;
    }
    const cacheKey = `${uid}:${section}`;
    const cachedAt = sectionCache.current.get(cacheKey) || 0;
    if (!force && cachedAt && Date.now() - cachedAt < 90000) {
      setSectionsReady((prev) => (prev[section] ? prev : { ...prev, [section]: true }));
      return;
    }
    setSectionLoading(true);
    const done = perfStart(`Profile ${section}`);
    const role = String(profileSnapshot.role || '').toLowerCase();
    const clubId = profileSnapshot.id ?? profileSnapshot.userId ?? uid;
    const needsTransfers = role === 'athlete' || role === 'coach' || role === 'trajner';
    try {
      if (section === 'posts') {
        const postsRes = await userPostsRequest(uid, { page: 1, limit: 20 }).catch(() => ({ data: [] }));
        if (gen !== requestGen.current) return;
        const postsData = Array.isArray(postsRes?.data) ? postsRes.data : [];
        setPosts(postsData);
        postsPageRef.current = 1;
        setPostsHasMore(String(postsRes?.headers?.['x-has-more'] || '0') === '1');
        setPostCount(Number(profileSnapshot.postsCount) || postsData.length);
      } else if (section === 'gallery') {
        const galleryRes = await userGalleryRequest(uid).catch(() => ({ data: [] }));
        if (gen !== requestGen.current) return;
        setGallery(Array.isArray(galleryRes?.data) ? galleryRes.data : []);
      } else if (section === 'videos') {
        const [videosRes, ytMediaRes] = await Promise.all([
          userVideosRequest(uid).catch(() => ({ data: [] })),
          role === 'club'
            ? clubMediaRequest(clubId, { limit: 24 }).catch(() => ({ data: { items: [] } }))
            : playerMediaRequest(uid, { limit: 24 }).catch(() => ({ data: { items: [] } })),
        ]);
        if (gen !== requestGen.current) return;
        setVideos(Array.isArray(videosRes?.data) ? videosRes.data : []);
        setYoutubeMedia(Array.isArray(ytMediaRes?.data?.items) ? ytMediaRes.data.items : []);
      } else if (section === 'overview') {
        const [staffRes, membersRes, clubStaffRes, rosterRes, transferRes, tournamentSummaryRes, galleryRes, videosRes] =
          await Promise.all([
            role === 'coach' || role === 'trajner'
              ? clubStaffAssignmentsRequest(uid).catch(() => ({ data: [] }))
              : Promise.resolve({ data: [] }),
            role === 'club'
              ? clubMembersByClubRequest(clubId, 'approved').catch(() => ({ data: [] }))
              : Promise.resolve({ data: [] }),
            role === 'club'
              ? clubStaffByClubRequest(clubId, { status: 'active' }).catch(() => ({ data: [] }))
              : Promise.resolve({ data: [] }),
            role === 'club'
              ? clubRosterByClubRequest(clubId).catch(() => ({ data: [] }))
              : Promise.resolve({ data: [] }),
            needsTransfers
              ? transferHistoryByUserRequest(uid).catch(() => ({ data: [] }))
              : Promise.resolve({ data: [] }),
            role === 'athlete'
              ? profileTournamentSummaryRequest(uid).catch(() => ({ data: { tournaments: [], totals: null } }))
              : Promise.resolve({ data: { tournaments: [], totals: null } }),
            userGalleryRequest(uid).catch(() => ({ data: [] })),
            userVideosRequest(uid).catch(() => ({ data: [] })),
          ]);
        if (gen !== requestGen.current) return;
        setStaffAssignments(Array.isArray(staffRes?.data) ? staffRes.data : []);
        setTransfers(Array.isArray(transferRes?.data) ? transferRes.data : []);
        setGallery(Array.isArray(galleryRes?.data) ? galleryRes.data : []);
        setVideos(Array.isArray(videosRes?.data) ? videosRes.data : []);
        sectionCache.current.set(`${uid}:gallery`, Date.now());
        if (role === 'athlete') {
          const tData = tournamentSummaryRes?.data || {};
          setTournamentSummary({
            tournaments: Array.isArray(tData.tournaments) ? tData.tournaments : [],
            totals: tData.totals || null,
          });
          sectionCache.current.set(`${uid}:tournaments`, Date.now());
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
      } else if (section === 'about') {
        const [transferRes, pendingRes] = await Promise.all([
          needsTransfers
            ? transferHistoryByUserRequest(uid).catch(() => ({ data: [] }))
            : Promise.resolve({ data: [] }),
          isClubViewer
            ? transferHistoryPendingForClubRequest().catch(() => ({ data: [] }))
            : Promise.resolve({ data: [] }),
        ]);
        if (gen !== requestGen.current) return;
        setTransfers(Array.isArray(transferRes?.data) ? transferRes.data : []);
        setClubPendingTransfers(Array.isArray(pendingRes?.data) ? pendingRes.data : []);
      } else if (section === 'achievements') {
        if (isSelf && role === 'athlete') {
          const res = await gamificationAchievementsRequest().catch(() => ({ data: [] }));
          if (gen !== requestGen.current) return;
          setPlatformAchievements(Array.isArray(res?.data) ? res.data : []);
        } else if (gen === requestGen.current) {
          setPlatformAchievements([]);
        }
      } else if (section === 'sponsors') {
        if (isSelf) {
          const res = await sponsorsByUserRequest(uid).catch(() => ({ data: [] }));
          if (gen !== requestGen.current) return;
          setSponsors(Array.isArray(res?.data) ? res.data : []);
        }
      } else if (section === 'tournaments') {
        if (role === 'athlete') {
          const res = await profileTournamentSummaryRequest(uid).catch(() => ({ data: { tournaments: [], totals: null } }));
          if (gen !== requestGen.current) return;
          const tData = res?.data || {};
          setTournamentSummary({
            tournaments: Array.isArray(tData.tournaments) ? tData.tournaments : [],
            totals: tData.totals || null,
          });
        }
      }
      if (gen !== requestGen.current) return;
      sectionCache.current.set(cacheKey, Date.now());
      setSectionsReady((prev) => ({ ...prev, [section]: true, ...(section === 'overview' ? { gallery: true, tournaments: role === 'athlete' ? true : prev.tournaments } : {}) }));
    } finally {
      done();
      if (gen === requestGen.current) setSectionLoading(false);
    }
  }, [isClubViewer, isSelf, userId]);

  const loadProfile = useCallback(async ({ silent } = {}) => {
    sectionCache.current.clear();
    await loadCore({ silent });
    setSectionReload((n) => n + 1);
  }, [loadCore]);

  useFocusEffect(
    useCallback(() => {
      if (userId == null || userId === '') {
        setError('Mungon përdoruesi');
        setLoading(false);
        return undefined;
      }
      const fresh = coreAt.current.id === String(userId) && Date.now() - coreAt.current.ts < 60000;
      if (!fresh) loadCore({ silent: coreAt.current.id === String(userId) });
      return () => {
        coreAbort.current?.abort();
      };
    }, [loadCore, userId])
  );

  useEffect(() => {
    if (!profile) return undefined;
    const force = appliedReload.current !== sectionReload;
    appliedReload.current = sectionReload;
    loadSection(profileTab, profile, { force });
    return undefined;
  }, [loadSection, profile, profileTab, sectionReload]);

  const loadMoreProfilePosts = useCallback(async () => {
    if (!userId || postsLoadingMore || !postsHasMore) return;
    const nextPage = postsPageRef.current + 1;
    setPostsLoadingMore(true);
    try {
      const postsRes = await userPostsRequest(userId, { page: nextPage, limit: 20 });
      const postsData = Array.isArray(postsRes?.data) ? postsRes.data : [];
      setPosts((prev) => {
        const seen = new Set(prev.map((item) => String(item.id)));
        const extra = postsData.filter((item) => !seen.has(String(item.id)));
        return extra.length ? [...prev, ...extra] : prev;
      });
      postsPageRef.current = nextPage;
      setPostsHasMore(String(postsRes?.headers?.['x-has-more'] || '0') === '1');
    } catch (_err) {
      /* keep the posts already shown */
    } finally {
      setPostsLoadingMore(false);
    }
  }, [postsHasMore, postsLoadingMore, userId]);

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
      Alert.alert('Validim', 'Klubi i destinacionit është i detyrueshëm.');
      return;
    }
    if (!transferForm.season.trim()) {
      Alert.alert('Validim', 'Sezoni është i detyrueshëm (p.sh. 2026-2027).');
      return;
    }
    setTransferSaving(true);
    try {
      await addTransferHistoryRequest({
        transferType: 'player_transfer',
        fromClub: transferForm.fromClub.trim() || null,
        toClub: transferForm.toClub.trim(),
        position: transferForm.position.trim() || null,
        season: transferForm.season.trim(),
        transferDate: transferForm.transferDate.trim() || undefined,
        notes: transferForm.notes.trim() || null,
      });
      setTransferModalOpen(false);
      await loadProfile({ silent: true });
    } catch (err) {
      Alert.alert('Gabim', extractErrorMessage(err, 'Nuk u arrit shtimi i transferit'));
    } finally {
      setTransferSaving(false);
    }
  };

  const onDeleteTransfer = (transfer) => {
    Alert.alert('Fshi transferin', 'Ta heq këtë regjistrim transferi?', [
      { text: 'Anulo', style: 'cancel' },
      {
        text: 'Fshi',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTransferHistoryRequest(transfer.id);
            await loadProfile({ silent: true });
          } catch (err) {
            Alert.alert('Gabim', extractErrorMessage(err, 'Nuk u arrit fshirja e transferit'));
          }
        },
      },
    ]);
  };

  const onConfirmTransfer = async (transfer) => {
    if (!transfer?.id) return;
    setActionTransferId(transfer.id);
    try {
      await confirmTransferHistoryRequest(transfer.id);
      await loadProfile({ silent: true });
    } catch (err) {
      Alert.alert('Gabim', extractErrorMessage(err, 'Konfirmimi dështoi'));
    } finally {
      setActionTransferId(null);
    }
  };

  const onRejectTransfer = (transfer) => {
    if (!transfer?.id) return;
    Alert.alert('Refuzo transferin', 'Refuzo këtë transfer?', [
      { text: 'Anulo', style: 'cancel' },
      {
        text: 'Refuzo',
        style: 'destructive',
        onPress: async () => {
          setActionTransferId(transfer.id);
          try {
            await rejectTransferHistoryRequest(transfer.id);
            await loadProfile({ silent: true });
          } catch (err) {
            Alert.alert('Gabim', extractErrorMessage(err, 'Refuzimi dështoi'));
          } finally {
            setActionTransferId(null);
          }
        },
      },
    ]);
  };

  const openFollowList = async (mode) => {
    if (!userId) return;
    setFollowListMode(mode);
    setFollowListLoading(true);
    setFollowListRows([]);
    try {
      const res =
        mode === 'followers'
          ? await followersListRequest(userId)
          : await followingListRequest(userId);
      const raw = Array.isArray(res?.data) ? res.data : [];
      const rows = raw
        .map((row) => {
          const u = mode === 'followers' ? row.follower || row : row.following || row;
          if (!u?.id) return null;
          return {
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            profilePhoto: u.Profile?.profilePhoto || u.profilePhoto || null,
          };
        })
        .filter(Boolean);
      setFollowListRows(rows);
    } catch (err) {
      Alert.alert('Lista', extractErrorMessage(err, 'Nuk u ngarkua lista'));
      setFollowListMode(null);
    } finally {
      setFollowListLoading(false);
    }
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
      Alert.alert('Ndjekja', extractErrorMessage(err, 'Nuk u arrit përditësimi i statusit të ndjekjes'));
    } finally {
      setBusy(false);
    }
  };

  const onSendMessage = async () => {
    try {
      const res = await getOrCreateConversationRequest(userId);
      const conversationId = res?.data?.id;
      if (!conversationId) throw new Error('Biseda nuk u krijua');
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
      Alert.alert('Mesazh', extractErrorMessage(err, 'Nuk u arrit hapja e bisedës'));
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
      bg: colors.bg,
      card: colors.card,
      border: colors.border,
      text: colors.text,
      muted: colors.muted,
      primary: colors.primary,
      primaryText: colors.primaryText,
      chipBg: colors.bgElevated,
      chipText: colors.textSecondary,
      coverFallback: isDark ? ['#111B29', '#202C3B'] : ['#344054', '#667085'],
    }),
    [isDark, colors]
  );

  const tabs = useMemo(() => {
    const base = [
      { key: 'overview', label: 'Përmbledhje' },
      { key: 'posts', label: 'Postime' },
    ];
    if (isAthlete) {
      base.push({ key: 'matches', label: 'Ndeshje' });
      base.push({ key: 'tournaments', label: 'Turne' });
      base.push({ key: 'achievements', label: 'Arritje' });
    }
    base.push(
      { key: 'gallery', label: 'Galeria' },
      { key: 'videos', label: 'Videot' },
      { key: 'about', label: 'Rreth' },
      { key: 'contact', label: 'Kontakt' }
    );
    if (isSelf) base.push({ key: 'sponsors', label: 'Sponsorë' });
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
        <ActivityIndicator size="large" color="#9A6B12" />
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
        <Text style={{ color: theme.muted }}>Profili nuk u gjet</Text>
      </View>
    );
  }

  const initials = `${(profile.firstName || 'U').charAt(0)}${(profile.lastName || '').charAt(0)}`.toUpperCase();
  const coverUri = profile.coverPhoto && typeof profile.coverPhoto === 'string' ? profile.coverPhoto : null;
  const photoUri = profile.profilePhoto && typeof profile.profilePhoto === 'string' ? profile.profilePhoto : null;
  const stats = profile.stats && typeof profile.stats === 'object' ? profile.stats : {};
  const contact = profile.contact && typeof profile.contact === 'object' ? profile.contact : {};
  const themeAccent =
    PROFILE_THEMES.find((t) => t.id === (profile.profileTheme || 'default'))?.accent || '#9A6B12';

  const Chip = ({ icon, imageUri, onPress, children }) => {
    if (!children) return null;
    const body = (
      <View style={[styles.chip, { backgroundColor: theme.chipBg, borderColor: themeAccent, borderWidth: 1 }]}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.chipLogo} />
        ) : icon ? (
          <Ionicons name={icon} size={14} color={theme.chipText} style={{ marginRight: 4 }} />
        ) : null}
        <Text style={[styles.chipText, { color: theme.chipText }]} numberOfLines={2}>
          {children}
        </Text>
      </View>
    );
    if (onPress) {
      return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
          {body}
        </TouchableOpacity>
      );
    }
    return body;
  };

  const closeHeaderPreview = () => setHeaderImagePreview(null);
  const tabReady = !!sectionsReady[profileTab];

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
          colors={[theme.primary]}
        />
      }
    >
      <View style={{ paddingTop: insets.top ? 0 : 0 }}>
        {coverUri ? (
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => setHeaderImagePreview(coverUri)}
            accessibilityRole="imagebutton"
            accessibilityLabel="Shiko foton e kopertinës"
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
              accessibilityLabel={photoUri ? 'Shiko foton e profilit' : undefined}
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
                <View style={[styles.avatarFallback, { backgroundColor: theme.primary }]}>
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
            {profile.verificationStatus ? (
              <Text style={[styles.roleLine, { color: theme.muted }]}>
                {profile.verificationStatus === 'VERIFIED'
                  ? 'I verifikuar'
                  : profile.verificationStatus === 'PENDING'
                    ? 'Verifikimi në pritje'
                    : profile.verificationStatus === 'REJECTED'
                      ? 'Verifikimi u refuzua'
                      : 'I paverifikuar'}
                {profile.completeness?.percent != null ? ` · ${profile.completeness.percent}%` : ''}
              </Text>
            ) : null}

            <View style={styles.chipRow}>
              {isOrgProfileRole(profile.role) ? (
                (profile.foundingYear || getFoundingYear(profile)) ? (
                  <Chip icon="flag-outline">
                    Themeluar {profile.foundingYear || getFoundingYear(profile)}
                  </Chip>
                ) : null
              ) : profile.age != null && profile.ageGroup ? (
                <Chip icon="calendar-outline">
                  {profile.age} vjeç ({profile.ageGroup})
                </Chip>
              ) : null}
              {profile.position && !isOrgProfileRole(profile.role) ? (
                <Chip icon="football-outline">{profile.position}</Chip>
              ) : null}
              {profile.club && !isOrgProfileRole(profile.role) ? (
                <Chip
                  icon="business-outline"
                  imageUri={
                    profile.clubLogo && typeof profile.clubLogo === 'string' ? profile.clubLogo : null
                  }
                  onPress={
                    profile.clubId
                      ? () => navigation.push('PublicProfile', { userId: profile.clubId })
                      : undefined
                  }
                >
                  {profile.club}
                </Chip>
              ) : null}
              {stats.jerseyNumber != null &&
              String(stats.jerseyNumber) !== '' &&
              !isOrgProfileRole(profile.role) ? (
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
                <Text style={[styles.statLabel, { color: theme.muted }]}>Postime</Text>
              </View>
              <TouchableOpacity style={styles.statCell} onPress={() => openFollowList('followers')}>
                <Text style={[styles.statNum, { color: theme.text }]}>{profile.followers ?? 0}</Text>
                <Text style={[styles.statLabel, { color: theme.muted }]}>Ndjekës</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.statCell} onPress={() => openFollowList('following')}>
                <Text style={[styles.statNum, { color: theme.text }]}>{profile.following ?? 0}</Text>
                <Text style={[styles.statLabel, { color: theme.muted }]}>Duke ndjekur</Text>
              </TouchableOpacity>
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
                    {busy ? '…' : following ? 'Duke ndjekur' : 'Ndiq'}
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
                  <Text style={[styles.msgBtnText, { color: theme.text }]}>Mesazh</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.videoBtn} onPress={onVideoCall}>
                  <Ionicons name="videocam-outline" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.selfActionsWrap}>
                {joncoinBalance != null ? (
                  <View style={[styles.joncoinBanner, { borderColor: theme.border, backgroundColor: theme.chipBg }]}>
                    <Text style={styles.joncoinLabel}>XCoin</Text>
                    <Text style={styles.joncoinValue}>{joncoinBalance}</Text>
                  </View>
                ) : null}
                <TouchableOpacity style={styles.goLiveBtn} onPress={onGoLive} activeOpacity={0.88}>
                  <Ionicons name="videocam" size={20} color="#fff" />
                  <Text style={styles.goLiveBtnText}>Dil LIVE</Text>
                </TouchableOpacity>
                <View style={styles.selfActionsRow}>
                  <TouchableOpacity
                    style={styles.selfPrimaryBtn}
                    onPress={() => navigation.navigate('EditProfile')}
                  >
                    <Ionicons name="create-outline" size={18} color="#fff" />
                    <Text style={styles.selfPrimaryBtnText}>Ndrysho profilin</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.selfSecondaryBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
                    onPress={() => navigation.navigate('BrowseProfiles')}
                  >
                    <Ionicons name="people-outline" size={18} color="#9A6B12" />
                    <Text style={styles.selfSecondaryBtnText}>Shfleto</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <PublicProfileTabBar tabs={tabs} activeKey={profileTab} onChange={setProfileTab} theme={theme} />
            <View style={styles.tabPanel}>
              {!tabReady ? (
                <ActivityIndicator color={theme.primary} style={{ marginVertical: 28 }} />
              ) : null}
              {tabReady && profileTab === 'overview' ? (
                <PublicProfileOverviewTab
                  profile={profile}
                  theme={theme}
                  staffAssignments={staffAssignments}
                  clubMembers={clubMembers}
                  clubStaff={clubStaff}
                  transfers={transfers}
                  tournamentSummary={tournamentSummary}
                  gallery={gallery}
                  videos={videos}
                  onPressUser={(uid) => navigation.push('PublicProfile', { userId: uid })}
                  onOpenTab={setProfileTab}
                />
              ) : null}
              {tabReady && profileTab === 'posts' ? (
                <PublicProfilePostsTab
                  posts={posts}
                  theme={theme}
                  hasMore={postsHasMore}
                  loadingMore={postsLoadingMore}
                  onLoadMore={loadMoreProfilePosts}
                />
              ) : null}
              {tabReady && profileTab === 'matches' && isAthlete ? (
                <PublicProfileMatchHistoryTab profile={profile} theme={theme} />
              ) : null}
              {tabReady && profileTab === 'tournaments' && isAthlete ? (
                <PublicProfileTournamentsTab
                  tournaments={tournamentSummary.tournaments}
                  totals={tournamentSummary.totals}
                  theme={theme}
                  onPressTournament={(tournamentId) => openTournamentDetail(navigation, tournamentId)}
                />
              ) : null}
              {tabReady && profileTab === 'achievements' && isAthlete ? (
                <PublicProfileAchievementsTab
                  profile={profile}
                  theme={theme}
                  platformAchievements={platformAchievements}
                  isSelf={isSelf}
                  onOpenInsights={isSelf ? onOpenInsights : undefined}
                />
              ) : null}
              {tabReady && profileTab === 'gallery' ? <PublicProfileGalleryTab items={gallery} theme={theme} /> : null}
              {tabReady && profileTab === 'videos' ? (
                <PublicProfileVideosTab
                  videos={videos}
                  liveVideos={Array.isArray(profile?.liveVideos) ? profile.liveVideos : []}
                  youtubeMedia={youtubeMedia}
                  theme={theme}
                  canManage={isSelf}
                  mediaDefaults={{
                    playerId: String(profile?.role || '').toLowerCase() === 'athlete' ? userId : undefined,
                    clubId: String(profile?.role || '').toLowerCase() === 'club' ? userId : undefined,
                    category: 'profile',
                  }}
                  onMediaSaved={(item) => setYoutubeMedia((prev) => [item, ...prev])}
                />
              ) : null}
              {tabReady && profileTab === 'about' ? (
                <PublicProfileAboutTab
                  profile={profile}
                  transfers={transfers}
                  clubPending={clubPendingTransfers}
                  theme={theme}
                  isOwner={isSelf}
                  isClubViewer={isClubViewer}
                  myClubId={myClubId}
                  actionTransferId={actionTransferId}
                  onAddTransfer={onAddTransfer}
                  onDeleteTransfer={onDeleteTransfer}
                  onConfirmTransfer={onConfirmTransfer}
                  onRejectTransfer={onRejectTransfer}
                  onPressClub={(uid) => navigation.push('PublicProfile', { userId: uid })}
                  onPressAthlete={(uid) => navigation.push('PublicProfile', { userId: uid })}
                />
              ) : null}
              {tabReady && profileTab === 'contact' ? <PublicProfileContactTab profile={profile} theme={theme} /> : null}
              {tabReady && profileTab === 'sponsors' && isSelf ? (
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
          <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 18, marginBottom: 10 }}>
            Transferi mbetet në pritje derisa të dy klubet ta konfirmojnë. Klubi aktual ndryshon vetëm pas konfirmimit të dyanshëm.
          </Text>
          <TextInput
            style={styles.transferInput}
            placeholder="From club"
            placeholderTextColor="#94a3b8"
            value={transferForm.fromClub}
            onChangeText={(v) => setTransferForm((f) => ({ ...f, fromClub: v }))}
          />
          <TextInput
            style={styles.transferInput}
            placeholder="To club * (emri i saktë i klubit)"
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

    <Modal
      visible={!!followListMode}
      animationType="slide"
      transparent
      onRequestClose={() => setFollowListMode(null)}
    >
      <View style={styles.followModalBackdrop}>
        <View style={[styles.followModalSheet, { backgroundColor: isDark ? '#0f172a' : '#fff' }]}>
          <View style={styles.followModalHeader}>
            <Text style={[styles.followModalTitle, { color: theme.text }]}>
              {followListMode === 'followers' ? 'Ndjekës' : 'Duke ndjekur'}
            </Text>
            <TouchableOpacity onPress={() => setFollowListMode(null)} hitSlop={12}>
              <Ionicons name="close" size={24} color={theme.muted} />
            </TouchableOpacity>
          </View>
          {followListLoading ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color="#9A6B12" />
          ) : followListRows.length === 0 ? (
            <Text style={[styles.followEmpty, { color: theme.muted }]}>
              {followListMode === 'followers' ? 'Nuk ka ndjekës ende.' : 'Nuk po ndjek askënd ende.'}
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: 420 }}>
              {followListRows.map((u) => {
                const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || `User #${u.id}`;
                const photo = u.profilePhoto && typeof u.profilePhoto === 'string' ? u.profilePhoto : null;
                return (
                  <TouchableOpacity
                    key={String(u.id)}
                    style={styles.followRow}
                    onPress={() => {
                      setFollowListMode(null);
                      openUserProfile(navigation, u.id);
                    }}
                  >
                    {photo ? (
                      <Image source={{ uri: photo }} style={styles.followAvatar} />
                    ) : (
                      <View style={[styles.followAvatar, styles.followAvatarPh]}>
                        <Text style={styles.followAvatarText}>
                          {`${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`.toUpperCase() || '?'}
                        </Text>
                      </View>
                    )}
                    <Text style={[styles.followName, { color: theme.text }]} numberOfLines={1}>
                      {name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>

    <ReportSheet
      visible={reportOpen}
      onClose={() => setReportOpen(false)}
      targetType="profile"
      targetId={userId}
      title="Raporto profilin"
    />
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
    color: '#9A6B12',
    fontWeight: '700',
    fontSize: 15,
  },
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
  chipLogo: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginRight: 6,
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
    backgroundColor: '#9A6B12',
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
    borderColor: '#9A6B12',
    paddingVertical: 10,
    borderRadius: 10,
    maxWidth: 140,
  },
  selfSecondaryBtnText: { color: '#9A6B12', fontWeight: '800', fontSize: 15 },
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
  transferSaveBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: '#9A6B12' },
  transferSaveText: { color: '#fff', fontWeight: '700' },
  followModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  followModalSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
    maxHeight: '75%',
  },
  followModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  followModalTitle: { fontSize: 18, fontWeight: '800' },
  followEmpty: { textAlign: 'center', paddingVertical: 28, fontSize: 14 },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  followAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e2e8f0' },
  followAvatarPh: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#9A6B12' },
  followAvatarText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  followName: { flex: 1, fontWeight: '700', fontSize: 15 },
});
