import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from '../theme/nativeComponents';
import {
  adminAnalyticsRequest,
  adminBanUserRequest,
  adminCreateStadiumRequest,
  adminDeletePostRequest,
  adminDeleteStadiumRequest,
  adminDeleteTournamentRequest,
  adminDeleteUserRequest,
  adminInvoicesRequest,
  adminJoncoinPendingRequest,
  adminJoncoinUpdateStatusRequest,
  adminPostsRequest,
  adminReportsRequest,
  adminResetUserPasswordRequest,
  adminReviewReportRequest,
  adminStadiumsRequest,
  adminTogglePremiumRequest,
  adminTournamentsRequest,
  adminUnbanUserRequest,
  adminUpdateStadiumRequest,
  adminUpdateTournamentRequest,
  adminUpdateUserRoleRequest,
  adminUsersRequest,
  adminVerifyUserRequest,
  extractErrorMessage,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'content', label: 'Content' },
  { id: 'reports', label: 'Reports' },
  { id: 'joncoin', label: 'XCoin' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'stadiums', label: 'Stadiums' },
  { id: 'tournaments', label: 'Tournaments' },
];

const REPORT_STATUSES = ['pending', 'reviewed', 'actioned', 'dismissed', 'all'];
const ROLE_FILTERS = ['', 'athlete', 'coach', 'club', 'scout', 'parent', 'admin'];

const emptyStadiumForm = {
  name: '',
  city: '',
  country: 'Kosovë',
  capacity: '',
  address: '',
  photo: '',
  featured: false,
  days: '7',
};

function StatChip({ label, value, colors }) {
  return (
    <View style={[styles.statChip, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
      <Text style={[styles.statValue, { color: colors.text }]}>{value ?? 0}</Text>
      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

export default function AdminDashboardScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [reports, setReports] = useState([]);
  const [joncoinPending, setJoncoinPending] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [stadiums, setStadiums] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [newRole, setNewRole] = useState('athlete');
  const [passwordDraft, setPasswordDraft] = useState('123456');
  const [roleFilter, setRoleFilter] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState('');
  const [reportsStatus, setReportsStatus] = useState('pending');
  const [stadiumForm, setStadiumForm] = useState(emptyStadiumForm);
  const [editingStadiumId, setEditingStadiumId] = useState(null);
  const [stadiumPhotoFile, setStadiumPhotoFile] = useState(null);
  const [stadiumPhotoPreview, setStadiumPhotoPreview] = useState('');
  const [clearStadiumPhoto, setClearStadiumPhoto] = useState(false);
  const [stadiumSaving, setStadiumSaving] = useState(false);

  const isAdmin = user?.role === 'admin';

  const resetStadiumForm = () => {
    setStadiumForm(emptyStadiumForm);
    setEditingStadiumId(null);
    setStadiumPhotoFile(null);
    setStadiumPhotoPreview('');
    setClearStadiumPhoto(false);
  };

  const startEditStadium = (s) => {
    let daysLeft = '7';
    if (s.featured && s.featuredStart && s.featuredEnd) {
      const ms = new Date(s.featuredEnd) - new Date();
      daysLeft = String(Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000))));
    }
    setEditingStadiumId(s.id);
    setStadiumForm({
      name: s.name || '',
      city: s.city || '',
      country: s.country || 'Kosovë',
      capacity: s.capacity != null ? String(s.capacity) : '',
      address: s.address || '',
      photo: s.photo || '',
      featured: Boolean(s.featured),
      days: daysLeft,
    });
    setStadiumPhotoFile(null);
    setClearStadiumPhoto(false);
    setStadiumPhotoPreview(s.photo || '');
  };

  const pickStadiumPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Media permission is required for stadium photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setStadiumPhotoFile({
      uri: asset.uri,
      name: asset.fileName || `stadium-${Date.now()}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    });
    setStadiumPhotoPreview(asset.uri);
    setClearStadiumPhoto(false);
  };

  const removeStadiumPhoto = () => {
    setStadiumPhotoFile(null);
    setStadiumPhotoPreview('');
    setStadiumForm((prev) => ({ ...prev, photo: '' }));
    if (editingStadiumId) setClearStadiumPhoto(true);
  };

  const saveStadium = async () => {
    if (stadiumSaving) return;
    if (!stadiumForm.name.trim()) {
      setError('Emri i stadiumit është i detyrueshëm.');
      return;
    }
    setStadiumSaving(true);
    setError('');
    try {
      const payload = {
        name: stadiumForm.name.trim(),
        city: stadiumForm.city.trim(),
        country: stadiumForm.country.trim(),
        capacity: stadiumForm.capacity,
        address: stadiumForm.address.trim(),
        featured: stadiumForm.featured ? 'true' : 'false',
      };
      if (stadiumForm.featured) {
        payload.days = stadiumForm.days || '7';
      }
      if (stadiumPhotoFile) {
        payload.photo = stadiumPhotoFile;
      } else if (clearStadiumPhoto) {
        payload.clearPhoto = '1';
      } else if (stadiumForm.photo && /^https?:\/\//i.test(stadiumForm.photo.trim())) {
        payload.photo = stadiumForm.photo.trim();
      }

      if (editingStadiumId) {
        await adminUpdateStadiumRequest(editingStadiumId, payload);
      } else {
        await adminCreateStadiumRequest(payload);
      }
      resetStadiumForm();
      await loadData({ silent: true });
    } catch (err) {
      setError(extractErrorMessage(err, 'Ruajtja e stadiumit dështoi'));
    } finally {
      setStadiumSaving(false);
    }
  };

  const listData = useMemo(() => {
    switch (activeTab) {
      case 'users':
        return users;
      case 'content':
        return posts;
      case 'reports':
        return reports;
      case 'joncoin':
        return joncoinPending;
      case 'invoices':
        return invoices;
      case 'stadiums':
        return stadiums;
      case 'tournaments':
        return tournaments;
      default:
        return [];
    }
  }, [activeTab, users, posts, reports, joncoinPending, invoices, stadiums, tournaments]);

  const loadData = useCallback(
    async ({ silent } = { silent: false }) => {
      if (!silent) setLoading(true);
      setError('');
      try {
        const analyticsRes = await adminAnalyticsRequest();
        setAnalytics(analyticsRes?.data || null);

        if (activeTab === 'users') {
          const usersRes = await adminUsersRequest({
            page,
            limit: 20,
            search: search || undefined,
            role: roleFilter || undefined,
            verified: verifiedFilter || undefined,
          });
          setUsers(Array.isArray(usersRes?.data?.users) ? usersRes.data.users : []);
          setPages(Number(usersRes?.data?.pages || 1));
        } else if (activeTab === 'content') {
          const postsRes = await adminPostsRequest({ page, limit: 20, search: search || undefined });
          setPosts(Array.isArray(postsRes?.data?.posts) ? postsRes.data.posts : []);
          setPages(Number(postsRes?.data?.pages || 1));
        } else if (activeTab === 'reports') {
          const reportsRes = await adminReportsRequest({
            page,
            limit: 20,
            status: reportsStatus || 'pending',
          });
          setReports(Array.isArray(reportsRes?.data?.reports) ? reportsRes.data.reports : []);
          setPages(Number(reportsRes?.data?.pages || 1));
        } else if (activeTab === 'joncoin') {
          const jcRes = await adminJoncoinPendingRequest();
          setJoncoinPending(Array.isArray(jcRes?.data?.transactions) ? jcRes.data.transactions : []);
          setPages(1);
        } else if (activeTab === 'invoices') {
          const invRes = await adminInvoicesRequest({
            page,
            limit: 20,
            search: search || undefined,
          });
          setInvoices(Array.isArray(invRes?.data?.invoices) ? invRes.data.invoices : []);
          setPages(Number(invRes?.data?.pages || 1));
        } else if (activeTab === 'stadiums') {
          const stRes = await adminStadiumsRequest({ q: search || undefined, limit: 100 });
          const rows = stRes?.data?.stadiums || stRes?.data || [];
          setStadiums(Array.isArray(rows) ? rows : []);
          setPages(1);
        } else if (activeTab === 'tournaments') {
          const tRes = await adminTournamentsRequest({ q: search || undefined, limit: 100 });
          setTournaments(Array.isArray(tRes?.data?.tournaments) ? tRes.data.tournaments : []);
          setPages(1);
        } else {
          setPages(1);
        }
      } catch (err) {
        setError(extractErrorMessage(err, 'Could not load admin data'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeTab, page, search, roleFilter, verifiedFilter, reportsStatus]
  );

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin, loadData]);

  const runAction = async (fn, ...args) => {
    try {
      await fn(...args);
      loadData({ silent: true });
    } catch (err) {
      setError(extractErrorMessage(err, 'Admin action failed'));
    }
  };

  const askDelete = (type, onConfirm) => {
    Alert.alert('Confirm', `Delete this ${type}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
    ]);
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    setPage(1);
    setSearch('');
    setError('');
    if (tab !== 'stadiums') resetStadiumForm();
  };

  if (!isAdmin) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <Text style={[styles.denied, { color: colors.danger }]}>Admin access required.</Text>
      </View>
    );
  }

  const totals = analytics?.totals || {};
  const health = analytics?.systemHealth || {};
  const recent = analytics?.recentActivity || {};

  const showSearch = ['users', 'content', 'invoices', 'stadiums', 'tournaments'].includes(activeTab);
  const showPagination = ['users', 'content', 'reports', 'invoices'].includes(activeTab);

  const renderItem = ({ item }) => {
    if (activeTab === 'content') {
      return (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.name, { color: colors.text }]}>Post #{item?.id || '-'}</Text>
          <Text style={[styles.meta, { color: colors.muted }]}>{item?.content || 'No content'}</Text>
          <Text style={[styles.meta, { color: colors.muted }]}>
            Author: {item?.User?.firstName || '-'} {item?.User?.lastName || ''}
          </Text>
          <TouchableOpacity
            style={[styles.action, styles.remove]}
            onPress={() => askDelete('post', () => runAction(adminDeletePostRequest, item.id))}
          >
            <Text style={styles.actionText}>Delete Post</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (activeTab === 'users') {
      const banned = Boolean(item?.bannedAt);
      return (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.name, { color: colors.text }]}>
            {item?.firstName || ''} {item?.lastName || ''} · @{item?.username || '-'}
          </Text>
          <Text style={[styles.meta, { color: colors.muted }]}>
            {item?.email || '-'} · {item?.role || '-'}
            {item?.verified ? ' · verified' : ''}
            {item?.premium ? ' · premium' : ''}
            {banned ? ' · BANNED' : ''}
          </Text>
          <TextInput
            value={newRole}
            onChangeText={setNewRole}
            placeholder="role"
            placeholderTextColor={colors.muted}
            style={[
              styles.inlineInput,
              { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text },
            ]}
          />
          <TextInput
            value={passwordDraft}
            onChangeText={setPasswordDraft}
            placeholder="New password"
            placeholderTextColor={colors.muted}
            style={[
              styles.inlineInput,
              { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text },
            ]}
          />
          <View style={styles.row}>
            {!item?.verified ? (
              <TouchableOpacity
                style={[styles.action, styles.verify]}
                onPress={() => runAction(adminVerifyUserRequest, item.id)}
              >
                <Text style={styles.actionText}>Verify</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.action, styles.premium]}
              onPress={() => runAction(adminTogglePremiumRequest, item.id)}
            >
              <Text style={styles.actionText}>{item?.premium ? 'Remove Premium' : 'Give Premium'}</Text>
            </TouchableOpacity>
            {banned ? (
              <TouchableOpacity
                style={[styles.action, styles.verify]}
                onPress={() => runAction(adminUnbanUserRequest, item.id)}
              >
                <Text style={styles.actionText}>Unban</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.action, styles.ban]}
                onPress={() => runAction(adminBanUserRequest, item.id)}
              >
                <Text style={styles.actionText}>Ban</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.action, styles.role]}
              onPress={() => runAction(adminUpdateUserRoleRequest, item.id, newRole)}
            >
              <Text style={styles.actionText}>Set Role</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.action, styles.reset]}
              onPress={() => runAction(adminResetUserPasswordRequest, item.id, passwordDraft)}
            >
              <Text style={styles.actionText}>Reset Password</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.action, styles.remove]}
              onPress={() => askDelete('user', () => runAction(adminDeleteUserRequest, item.id))}
            >
              <Text style={styles.actionText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (activeTab === 'reports') {
      const reporter = item?.reporter;
      return (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.name, { color: colors.text }]}>
            Report #{item?.id} · {item?.status || 'pending'}
          </Text>
          <Text style={[styles.meta, { color: colors.muted }]}>
            {item?.reason || item?.type || 'No reason'} · target: {item?.targetType || '-'} #{item?.targetId || '-'}
          </Text>
          <Text style={[styles.meta, { color: colors.muted }]}>
            By: {reporter?.firstName || '-'} {reporter?.lastName || ''} ({reporter?.email || '-'})
          </Text>
          {item?.details ? (
            <Text style={[styles.meta, { color: colors.muted }]}>{item.details}</Text>
          ) : null}
          {item?.status === 'pending' ? (
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.action, styles.verify]}
                onPress={() => runAction(adminReviewReportRequest, item.id, 'reviewed')}
              >
                <Text style={styles.actionText}>Reviewed</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.action, styles.ban]}
                onPress={() => runAction(adminReviewReportRequest, item.id, 'actioned')}
              >
                <Text style={styles.actionText}>Actioned</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.action, styles.remove]}
                onPress={() => runAction(adminReviewReportRequest, item.id, 'dismissed')}
              >
                <Text style={styles.actionText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      );
    }

    if (activeTab === 'joncoin') {
      const u = item?.User;
      return (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.name, { color: colors.text }]}>
            TX #{item?.id} · {item?.type || '-'} · {item?.amount ?? 0} XC
          </Text>
          <Text style={[styles.meta, { color: colors.muted }]}>
            {u?.firstName || ''} {u?.lastName || ''} · {u?.email || '-'} · bal: {u?.joncoinBalance ?? '-'}
          </Text>
          <Text style={[styles.meta, { color: colors.muted }]}>{item?.description || ''}</Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.action, styles.verify]}
              onPress={() => runAction(adminJoncoinUpdateStatusRequest, item.id, 'completed')}
            >
              <Text style={styles.actionText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.action, styles.remove]}
              onPress={() => runAction(adminJoncoinUpdateStatusRequest, item.id, 'rejected')}
            >
              <Text style={styles.actionText}>Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (activeTab === 'invoices') {
      const u = item?.User;
      return (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.name, { color: colors.text }]}>
            {item?.invoiceNumber || `INV #${item?.id}`} · {item?.amount ?? 0} {item?.currency || ''}
          </Text>
          <Text style={[styles.meta, { color: colors.muted }]}>
            {item?.kind || '-'} / {item?.source || '-'} · {item?.description || ''}
          </Text>
          <Text style={[styles.meta, { color: colors.muted }]}>
            {u?.email || u?.firstName || '—'} · {item?.createdAt ? String(item.createdAt).slice(0, 10) : ''}
          </Text>
        </View>
      );
    }

    if (activeTab === 'stadiums') {
      return (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {item?.photo ? (
            <Image source={{ uri: item.photo }} style={styles.stadiumThumb} resizeMode="cover" />
          ) : null}
          <Text style={[styles.name, { color: colors.text }]}>{item?.name || `Stadium #${item?.id}`}</Text>
          <Text style={[styles.meta, { color: colors.muted }]}>
            {[item?.city, item?.country].filter(Boolean).join(', ') || '-'} · capacity{' '}
            {item?.capacity ?? '-'}
          </Text>
          {item?.address ? (
            <Text style={[styles.meta, { color: colors.muted }]}>{item.address}</Text>
          ) : null}
          <Text style={[styles.meta, { color: colors.muted }]}>
            {item?.featured ? 'Featured' : 'Not featured'}
          </Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.action, styles.verify]} onPress={() => startEditStadium(item)}>
              <Text style={styles.actionText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.action, styles.remove]}
              onPress={() =>
                askDelete('stadium', () => {
                  if (editingStadiumId === item.id) resetStadiumForm();
                  runAction(adminDeleteStadiumRequest, item.id);
                })
              }
            >
              <Text style={styles.actionText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (activeTab === 'tournaments') {
      return (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.name, { color: colors.text }]}>{item?.name || `Tournament #${item?.id}`}</Text>
          <Text style={[styles.meta, { color: colors.muted }]}>
            {item?.type || '-'} · {item?.status || '-'} · {item?.season || ''}
          </Text>
          <Text style={[styles.meta, { color: colors.muted }]}>
            Creator: {item?.creator?.firstName || '-'} {item?.creator?.lastName || ''}
          </Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.action, styles.verify]}
              onPress={() => runAction(adminUpdateTournamentRequest, item.id, { status: 'active' })}
            >
              <Text style={styles.actionText}>Activate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.action, styles.ban]}
              onPress={() => runAction(adminUpdateTournamentRequest, item.id, { status: 'completed' })}
            >
              <Text style={styles.actionText}>Complete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.action, styles.remove]}
              onPress={() => askDelete('tournament', () => runAction(adminDeleteTournamentRequest, item.id))}
            >
              <Text style={styles.actionText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return null;
  };

  return (
    <FlatList
      data={listData}
      keyExtractor={(item, idx) => `${activeTab}-${item?.id ?? idx}`}
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { backgroundColor: colors.bg }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadData({ silent: true });
          }}
          colors={[colors.primary]}
        />
      }
      ListHeaderComponent={
        <View>
          <View
            style={[
              styles.headerCard,
              { backgroundColor: colors.card, borderColor: colors.primaryBorder },
            ]}
          >
            <Text style={[styles.headerTitle, { color: colors.text }]}>Admin Dashboard</Text>
            <Text style={[styles.headerSub, { color: colors.muted }]}>
              Users: {totals.users || 0} · Posts: {totals.posts || 0} · Reports: {totals.reports || 0}
            </Text>
            <Text style={[styles.headerSub, { color: colors.muted }]}>
              XCoin txs: {totals.joncoinTransactions || 0} · Pending reports:{' '}
              {health.pendingReports || 0}
            </Text>
            {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
            {loading ? (
              <Text style={[styles.headerSub, { color: colors.muted }]}>Loading…</Text>
            ) : null}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
            <View style={styles.tabsRow}>
              {TABS.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={[
                      styles.tabBtn,
                      { backgroundColor: colors.bgElevated, borderColor: colors.border },
                      active ? { backgroundColor: colors.primary, borderColor: colors.primary } : null,
                    ]}
                    onPress={() => switchTab(tab.id)}
                  >
                    <Text
                      style={[
                        styles.tabTxt,
                        { color: active ? colors.onPrimary : colors.textSecondary },
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {showSearch ? (
            <TextInput
              value={search}
              onChangeText={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Search"
              placeholderTextColor={colors.muted}
              style={[
                styles.searchInput,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                },
              ]}
            />
          ) : null}

          {activeTab === 'users' ? (
            <View style={styles.filterBlock}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.row}>
                  {ROLE_FILTERS.map((role) => {
                    const active = roleFilter === role;
                    return (
                      <TouchableOpacity
                        key={role || 'all'}
                        style={[
                          styles.filterChip,
                          { borderColor: colors.border, backgroundColor: colors.bgElevated },
                          active ? { backgroundColor: colors.primary, borderColor: colors.primary } : null,
                        ]}
                        onPress={() => {
                          setRoleFilter(role);
                          setPage(1);
                        }}
                      >
                        <Text
                          style={{
                            color: active ? colors.onPrimary : colors.textSecondary,
                            fontWeight: '700',
                            fontSize: 12,
                          }}
                        >
                          {role || 'all roles'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
              <View style={[styles.row, { marginTop: 8 }]}>
                {[
                  { v: '', l: 'All' },
                  { v: 'true', l: 'Verified' },
                  { v: 'false', l: 'Unverified' },
                ].map((opt) => {
                  const active = verifiedFilter === opt.v;
                  return (
                    <TouchableOpacity
                      key={opt.l}
                      style={[
                        styles.filterChip,
                        { borderColor: colors.border, backgroundColor: colors.bgElevated },
                        active ? { backgroundColor: colors.primary, borderColor: colors.primary } : null,
                      ]}
                      onPress={() => {
                        setVerifiedFilter(opt.v);
                        setPage(1);
                      }}
                    >
                      <Text
                        style={{
                          color: active ? colors.onPrimary : colors.textSecondary,
                          fontWeight: '700',
                          fontSize: 12,
                        }}
                      >
                        {opt.l}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}

          {activeTab === 'reports' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <View style={styles.row}>
                {REPORT_STATUSES.map((status) => {
                  const active = reportsStatus === status;
                  return (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.filterChip,
                        { borderColor: colors.border, backgroundColor: colors.bgElevated },
                        active ? { backgroundColor: colors.primary, borderColor: colors.primary } : null,
                      ]}
                      onPress={() => {
                        setReportsStatus(status);
                        setPage(1);
                      }}
                    >
                      <Text
                        style={{
                          color: active ? colors.onPrimary : colors.textSecondary,
                          fontWeight: '700',
                          fontSize: 12,
                        }}
                      >
                        {status}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          ) : null}

          {activeTab === 'overview' ? (
            <View>
              <Text style={[styles.section, { color: colors.text }]}>Totals</Text>
              <View style={styles.statsGrid}>
                <StatChip label="Users" value={totals.users} colors={colors} />
                <StatChip label="Posts" value={totals.posts} colors={colors} />
                <StatChip label="Comments" value={totals.comments} colors={colors} />
                <StatChip label="Likes" value={totals.likes} colors={colors} />
                <StatChip label="Matches" value={totals.matches} colors={colors} />
                <StatChip label="Tournaments" value={totals.tournaments} colors={colors} />
                <StatChip label="Videos" value={totals.videos} colors={colors} />
                <StatChip label="Streams" value={totals.streams} colors={colors} />
                <StatChip label="Messages" value={totals.messages} colors={colors} />
                <StatChip label="Live streams" value={totals.liveStreams} colors={colors} />
                <StatChip label="XCoin txs" value={totals.joncoinTransactions} colors={colors} />
                <StatChip label="Reports" value={totals.reports} colors={colors} />
                <StatChip label="Orders" value={totals.orders} colors={colors} />
                <StatChip label="Payments" value={totals.payments} colors={colors} />
                <StatChip label="Subs" value={totals.subscriptions} colors={colors} />
                <StatChip label="Blocks" value={totals.blocks} colors={colors} />
              </View>

              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.name, { color: colors.text }]}>System Health</Text>
                <Text style={[styles.meta, { color: colors.muted }]}>
                  Online now: {health.onlineUsers || health.liveNow || 0}
                </Text>
                <Text style={[styles.meta, { color: colors.muted }]}>
                  Active streams: {health.activeStreams || 0}
                </Text>
                <Text style={[styles.meta, { color: colors.muted }]}>
                  Verified: {health.verifiedUsers || 0} · Premium: {health.premiumUsers || 0}
                </Text>
                <Text style={[styles.meta, { color: colors.muted }]}>
                  Pending reports: {health.pendingReports || 0} · Processing videos:{' '}
                  {health.processingVideos || 0}
                </Text>
              </View>

              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.name, { color: colors.text }]}>Last 7 days</Text>
                <Text style={[styles.meta, { color: colors.muted }]}>
                  New users: {recent.users || 0} · New posts: {recent.posts || 0}
                </Text>
                <Text style={[styles.meta, { color: colors.muted }]}>
                  New videos: {recent.videos || 0} · Active users: {recent.activeUsers || 0}
                </Text>
              </View>
            </View>
          ) : (
            <View>
              <Text style={[styles.section, { color: colors.text }]}>
                {TABS.find((t) => t.id === activeTab)?.label || activeTab}
              </Text>

              {activeTab === 'stadiums' ? (
                <View
                  style={[
                    styles.card,
                    { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 12 },
                  ]}
                >
                  <Text style={[styles.name, { color: colors.text }]}>
                    {editingStadiumId ? 'Edito stadiumin' : 'Shto stadium'}
                  </Text>
                  <Text style={[styles.meta, { color: colors.muted, marginBottom: 8 }]}>
                    Katalogu i stadiumeve — klubet i zgjedhin nga Edit Profile.
                  </Text>
                  <TextInput
                    value={stadiumForm.name}
                    onChangeText={(v) => setStadiumForm((p) => ({ ...p, name: v }))}
                    placeholder="Emri *"
                    placeholderTextColor={colors.muted}
                    style={[
                      styles.inlineInput,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: colors.inputBorder,
                        color: colors.text,
                      },
                    ]}
                  />
                  <TextInput
                    value={stadiumForm.city}
                    onChangeText={(v) => setStadiumForm((p) => ({ ...p, city: v }))}
                    placeholder="Qyteti"
                    placeholderTextColor={colors.muted}
                    style={[
                      styles.inlineInput,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: colors.inputBorder,
                        color: colors.text,
                      },
                    ]}
                  />
                  <TextInput
                    value={stadiumForm.country}
                    onChangeText={(v) => setStadiumForm((p) => ({ ...p, country: v }))}
                    placeholder="Shteti"
                    placeholderTextColor={colors.muted}
                    style={[
                      styles.inlineInput,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: colors.inputBorder,
                        color: colors.text,
                      },
                    ]}
                  />
                  <TextInput
                    value={stadiumForm.capacity}
                    onChangeText={(v) => setStadiumForm((p) => ({ ...p, capacity: v }))}
                    placeholder="Kapaciteti"
                    keyboardType="number-pad"
                    placeholderTextColor={colors.muted}
                    style={[
                      styles.inlineInput,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: colors.inputBorder,
                        color: colors.text,
                      },
                    ]}
                  />
                  <TextInput
                    value={stadiumForm.address}
                    onChangeText={(v) => setStadiumForm((p) => ({ ...p, address: v }))}
                    placeholder="Adresa"
                    placeholderTextColor={colors.muted}
                    style={[
                      styles.inlineInput,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: colors.inputBorder,
                        color: colors.text,
                      },
                    ]}
                  />

                  <View style={[styles.row, { alignItems: 'center', marginBottom: 8 }]}>
                    <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>Featured</Text>
                    <Switch
                      value={stadiumForm.featured}
                      onValueChange={(v) => setStadiumForm((p) => ({ ...p, featured: v }))}
                    />
                  </View>
                  {stadiumForm.featured ? (
                    <TextInput
                      value={stadiumForm.days}
                      onChangeText={(v) => setStadiumForm((p) => ({ ...p, days: v }))}
                      placeholder="Ditë featured"
                      keyboardType="number-pad"
                      placeholderTextColor={colors.muted}
                      style={[
                        styles.inlineInput,
                        {
                          backgroundColor: colors.inputBg,
                          borderColor: colors.inputBorder,
                          color: colors.text,
                        },
                      ]}
                    />
                  ) : null}

                  {stadiumPhotoPreview ? (
                    <Image
                      source={{ uri: stadiumPhotoPreview }}
                      style={styles.stadiumPreview}
                      resizeMode="cover"
                    />
                  ) : null}
                  <View style={styles.row}>
                    <TouchableOpacity style={[styles.action, styles.role]} onPress={pickStadiumPhoto}>
                      <Text style={styles.actionText}>
                        {stadiumPhotoPreview ? 'Change Photo' : 'Add Photo'}
                      </Text>
                    </TouchableOpacity>
                    {stadiumPhotoPreview ? (
                      <TouchableOpacity style={[styles.action, styles.ban]} onPress={removeStadiumPhoto}>
                        <Text style={styles.actionText}>Remove Photo</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <View style={[styles.row, { marginTop: 8 }]}>
                    <TouchableOpacity
                      style={[styles.action, styles.premium, stadiumSaving ? styles.pageDisabled : null]}
                      onPress={saveStadium}
                      disabled={stadiumSaving}
                    >
                      <Text style={styles.actionText}>
                        {stadiumSaving ? 'Duke ruajtur…' : editingStadiumId ? 'Update' : 'Add Stadium'}
                      </Text>
                    </TouchableOpacity>
                    {editingStadiumId ? (
                      <TouchableOpacity style={[styles.action, styles.reset]} onPress={resetStadiumForm}>
                        <Text style={styles.actionText}>Cancel</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </View>
          )}
        </View>
      }
      renderItem={renderItem}
      ListFooterComponent={
        showPagination ? (
          <View style={styles.paginationRow}>
            <TouchableOpacity
              style={[styles.pageBtn, page <= 1 ? styles.pageDisabled : null]}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <Text style={styles.pageTxt}>Prev</Text>
            </TouchableOpacity>
            <Text style={[styles.pageIndicator, { color: colors.textSecondary }]}>
              Page {page} / {pages}
            </Text>
            <TouchableOpacity
              style={[styles.pageBtn, page >= pages ? styles.pageDisabled : null]}
              onPress={() => setPage((p) => (p < pages ? p + 1 : p))}
              disabled={page >= pages}
            >
              <Text style={styles.pageTxt}>Next</Text>
            </TouchableOpacity>
          </View>
        ) : null
      }
      ListEmptyComponent={
        !loading && activeTab !== 'overview' ? (
          <Text style={[styles.empty, { color: colors.muted }]}>No items found.</Text>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f8fafc' },
  denied: { color: '#991b1b', fontWeight: '700' },
  content: { padding: 14, paddingBottom: 30, backgroundColor: '#f8fafc', minHeight: '100%' },
  headerCard: {
    backgroundColor: '#ecfeff',
    borderWidth: 1,
    borderColor: '#a5f3fc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  headerTitle: { color: '#0f172a', fontWeight: '800', fontSize: 20 },
  headerSub: { color: '#155e75', marginTop: 4 },
  section: { color: '#0f172a', fontWeight: '800', marginBottom: 8, marginTop: 4 },
  tabsScroll: { marginBottom: 10 },
  tabsRow: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  tabBtn: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
    backgroundColor: '#f0f9ff',
  },
  tabTxt: { color: '#155e75', fontWeight: '700', fontSize: 13 },
  searchInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
    color: '#0f172a',
    marginBottom: 10,
  },
  filterBlock: { marginBottom: 10 },
  filterChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  statChip: {
    width: '23%',
    minWidth: 72,
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  statValue: { fontWeight: '800', fontSize: 16 },
  statLabel: { fontSize: 10, marginTop: 2, textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  name: { color: '#0f172a', fontWeight: '700' },
  meta: { color: '#475569', marginTop: 4, marginBottom: 4 },
  inlineInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
    color: '#0f172a',
    marginBottom: 8,
  },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  action: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10 },
  verify: { backgroundColor: '#2563eb' },
  premium: { backgroundColor: '#9A6B12' },
  ban: { backgroundColor: '#d97706' },
  role: { backgroundColor: '#7c3aed' },
  reset: { backgroundColor: '#4f46e5' },
  remove: { backgroundColor: '#dc2626' },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  pageBtn: { backgroundColor: '#9A6B12', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  pageDisabled: { opacity: 0.4 },
  pageTxt: { color: '#fff', fontWeight: '700' },
  pageIndicator: { color: '#334155', fontWeight: '700' },
  error: { color: '#b91c1c', marginTop: 8 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 20 },
  stadiumThumb: { width: '100%', height: 120, borderRadius: 8, marginBottom: 8, backgroundColor: '#e2e8f0' },
  stadiumPreview: { width: '100%', height: 140, borderRadius: 8, marginBottom: 8, backgroundColor: '#e2e8f0' },
});
