import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from '../theme/nativeComponents';
import {
  adminAnalyticsRequest,
  adminBanUserRequest,
  adminDeletePostRequest,
  adminDeleteUserRequest,
  adminPostsRequest,
  adminResetUserPasswordRequest,
  adminTogglePremiumRequest,
  adminUpdateUserRoleRequest,
  adminUsersRequest,
  adminVerifyUserRequest,
  extractErrorMessage,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function AdminDashboardScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [newRole, setNewRole] = useState('athlete');
  const [passwordDraft, setPasswordDraft] = useState('123456');

  const isAdmin = user?.role === 'admin';

  const loadData = useCallback(async ({ silent } = { silent: false }) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const analyticsRes = await adminAnalyticsRequest();
      setAnalytics(analyticsRes?.data || null);

      if (activeTab === 'users') {
        const usersRes = await adminUsersRequest({ page, limit: 20, search });
        setUsers(Array.isArray(usersRes?.data?.users) ? usersRes.data.users : []);
        setPages(Number(usersRes?.data?.pages || 1));
      }

      if (activeTab === 'content') {
        const postsRes = await adminPostsRequest({ page, limit: 20, search });
        setPosts(Array.isArray(postsRes?.data?.posts) ? postsRes.data.posts : []);
        setPages(Number(postsRes?.data?.pages || 1));
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not load admin data'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, page, search]);

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin, loadData]);

  const runUserAction = async (fn, userId) => {
    try {
      await fn(userId);
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

  if (!isAdmin) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <Text style={[styles.denied, { color: colors.danger }]}>Admin access required.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={activeTab === 'users' ? users : activeTab === 'content' ? posts : []}
      keyExtractor={(item, idx) => String(item?.id || idx)}
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
          <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.primaryBorder }]}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Admin Dashboard</Text>
            <Text style={[styles.headerSub, { color: colors.muted }]}>Users: {analytics?.totals?.users || 0} | Posts: {analytics?.totals?.posts || 0}</Text>
            <Text style={[styles.headerSub, { color: colors.muted }]}>Messages: {analytics?.totals?.messages || 0} | Likes: {analytics?.totals?.likes || 0}</Text>
            {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
          </View>

          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabBtn, { backgroundColor: colors.bgElevated, borderColor: colors.border }, activeTab === 'overview' ? { backgroundColor: colors.primary, borderColor: colors.primary } : null]}
              onPress={() => {
                setActiveTab('overview');
                setPage(1);
              }}
            >
              <Text style={[styles.tabTxt, { color: activeTab === 'overview' ? colors.onPrimary : colors.textSecondary }]}>Overview</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, { backgroundColor: colors.bgElevated, borderColor: colors.border }, activeTab === 'users' ? { backgroundColor: colors.primary, borderColor: colors.primary } : null]}
              onPress={() => {
                setActiveTab('users');
                setPage(1);
              }}
            >
              <Text style={[styles.tabTxt, { color: activeTab === 'users' ? colors.onPrimary : colors.textSecondary }]}>Users</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, { backgroundColor: colors.bgElevated, borderColor: colors.border }, activeTab === 'content' ? { backgroundColor: colors.primary, borderColor: colors.primary } : null]}
              onPress={() => {
                setActiveTab('content');
                setPage(1);
              }}
            >
              <Text style={[styles.tabTxt, { color: activeTab === 'content' ? colors.onPrimary : colors.textSecondary }]}>Content</Text>
            </TouchableOpacity>
          </View>

          {activeTab !== 'overview' ? (
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search"
              placeholderTextColor={colors.muted}
              style={[styles.searchInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
            />
          ) : null}

          {activeTab === 'overview' ? (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.name, { color: colors.text }]}>System Health</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>Active Streams: {analytics?.systemHealth?.activeStreams || 0}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>Verified Users: {analytics?.systemHealth?.verifiedUsers || 0}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>Premium Users: {analytics?.systemHealth?.premiumUsers || 0}</Text>
            </View>
          ) : (
            <Text style={[styles.section, { color: colors.text }]}>{activeTab === 'users' ? 'User Management' : 'Content Moderation'}</Text>
          )}
        </View>
      }
      renderItem={({ item }) => {
        if (activeTab === 'content') {
          return (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.name, { color: colors.text }]}>Post #{item?.id || '-'}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>{item?.content || 'No content'}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>Author: {item?.User?.firstName || '-'} {item?.User?.lastName || ''}</Text>
              <TouchableOpacity
                style={[styles.action, styles.remove]}
                onPress={() => askDelete('post', () => runUserAction(adminDeletePostRequest, item.id))}
              >
                <Text style={styles.actionText}>Delete Post</Text>
              </TouchableOpacity>
            </View>
          );
        }

        if (activeTab === 'users') {
          return (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.name, { color: colors.text }]}>{`${item?.firstName || ''} ${item?.lastName || ''}`.trim() || item?.email || 'User'}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>Role: {item?.role || '-'} | Verified: {item?.verified ? 'Yes' : 'No'} | Premium: {item?.premium ? 'Yes' : 'No'}</Text>
              <TextInput
                value={newRole}
                onChangeText={setNewRole}
                placeholder="Role"
                placeholderTextColor={colors.muted}
                style={[styles.inlineInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              />
              <TextInput
                value={passwordDraft}
                onChangeText={setPasswordDraft}
                placeholder="New password"
                placeholderTextColor={colors.muted}
                style={[styles.inlineInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              />
              <View style={styles.row}>
                {!item?.verified ? (
                  <TouchableOpacity style={[styles.action, styles.verify]} onPress={() => runUserAction(adminVerifyUserRequest, item.id)}>
                    <Text style={styles.actionText}>Verify</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={[styles.action, styles.premium]} onPress={() => runUserAction(adminTogglePremiumRequest, item.id)}>
                  <Text style={styles.actionText}>{item?.premium ? 'Remove Premium' : 'Give Premium'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.action, styles.ban]} onPress={() => runUserAction(adminBanUserRequest, item.id)}>
                  <Text style={styles.actionText}>Ban</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.action, styles.role]} onPress={() => runUserAction((id) => adminUpdateUserRoleRequest(id, newRole), item.id)}>
                  <Text style={styles.actionText}>Set Role</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.action, styles.reset]}
                  onPress={() => runUserAction((id) => adminResetUserPasswordRequest(id, passwordDraft), item.id)}
                >
                  <Text style={styles.actionText}>Reset Password</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.action, styles.remove]}
                  onPress={() => askDelete('user', () => runUserAction(adminDeleteUserRequest, item.id))}
                >
                  <Text style={styles.actionText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }

        return null;
      }}
      ListFooterComponent={
        activeTab !== 'overview' ? (
          <View style={styles.paginationRow}>
            <TouchableOpacity
              style={[styles.pageBtn, page <= 1 ? styles.pageDisabled : null]}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <Text style={styles.pageTxt}>Prev</Text>
            </TouchableOpacity>
            <Text style={[styles.pageIndicator, { color: colors.textSecondary }]}>Page {page} / {pages}</Text>
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
        !loading ? (
          <Text style={[styles.empty, { color: colors.muted }]}>
            {activeTab === 'content' ? 'No posts found.' : activeTab === 'users' ? 'No users found.' : 'Select a tab.'}
          </Text>
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
  section: { color: '#0f172a', fontWeight: '800', marginBottom: 8 },
  tabsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  tabBtn: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
    backgroundColor: '#f0f9ff',
  },
  tabActive: { backgroundColor: '#9A6B12', borderColor: '#9A6B12' },
  tabTxt: { color: '#155e75', fontWeight: '700' },
  tabTxtActive: { color: '#fff' },
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
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  name: { color: '#0f172a', fontWeight: '700' },
  meta: { color: '#475569', marginTop: 4, marginBottom: 8 },
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
  actionText: { color: '#fff', fontWeight: '700' },
  paginationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  pageBtn: { backgroundColor: '#9A6B12', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  pageDisabled: { opacity: 0.4 },
  pageTxt: { color: '#fff', fontWeight: '700' },
  pageIndicator: { color: '#334155', fontWeight: '700' },
  error: { color: '#b91c1c', marginTop: 8 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 20 },
});
