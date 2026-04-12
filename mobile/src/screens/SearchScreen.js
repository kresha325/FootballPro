import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  extractErrorMessage,
  recommendedUsersRequest,
  searchEverythingRequest,
  searchPostsRequest,
  searchUsersRequest,
  trendingSearchPostsRequest,
  trendingSearchUsersRequest,
} from '../api/client';

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('discover');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [userFilters, setUserFilters] = useState({ position: '', club: '' });
  const [postFilters, setPostFilters] = useState({ dateRange: 'all', minLikes: '' });
  const [discoverUsers, setDiscoverUsers] = useState([]);
  const [discoverPosts, setDiscoverPosts] = useState([]);
  const [discoverTournaments, setDiscoverTournaments] = useState([]);

  const isSearching = query.trim().length > 0 || activeTab !== 'discover';

  const loadDiscovery = useCallback(async ({ silent } = { silent: false }) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [recommendedRes, trendingUsersRes, trendingPostsRes] = await Promise.all([
        recommendedUsersRequest(),
        trendingSearchUsersRequest(),
        trendingSearchPostsRequest(),
      ]);

      const recommended = recommendedRes?.data?.users || recommendedRes?.data || [];
      const trendingUsers = trendingUsersRes?.data?.users || trendingUsersRes?.data || [];
      const trendingPosts = trendingPostsRes?.data?.posts || trendingPostsRes?.data || [];
      const universalTournaments = (await searchEverythingRequest({})).data?.tournaments || [];

      setDiscoverUsers([...(Array.isArray(recommended) ? recommended : []), ...(Array.isArray(trendingUsers) ? trendingUsers : [])].slice(0, 12));
      setDiscoverPosts(Array.isArray(trendingPosts) ? trendingPosts.slice(0, 12) : []);
      setDiscoverTournaments(Array.isArray(universalTournaments) ? universalTournaments.slice(0, 12) : []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not load discovery'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const runSearch = useCallback(async () => {
    const q = query.trim();
    if (!q && activeTab !== 'discover') {
      setError('Type a query first');
      return;
    }
    if (!q && activeTab === 'discover') {
      setUsers([]);
      setPosts([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'users') {
        const usersRes = await searchUsersRequest({ q, ...userFilters });
        setUsers(Array.isArray(usersRes?.data?.users) ? usersRes.data.users : []);
        setPosts([]);
      } else if (activeTab === 'posts') {
        const postsRes = await searchPostsRequest({ q, ...postFilters });
        setPosts(Array.isArray(postsRes?.data?.posts) ? postsRes.data.posts : []);
        setUsers([]);
      } else {
        const res = await searchEverythingRequest({ q });
        setUsers(Array.isArray(res?.data?.users) ? res.data.users : []);
        setPosts(Array.isArray(res?.data?.posts) ? res.data.posts : []);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Search failed'));
    } finally {
      setLoading(false);
    }
  }, [activeTab, postFilters, query, userFilters]);

  useEffect(() => {
    loadDiscovery();
  }, [loadDiscovery]);

  const listData = useMemo(() => {
    if (!isSearching) {
      return [
        { type: 'title', id: 'discover-users', label: 'Recommended / Trending Users' },
        ...discoverUsers.map((u, idx) => ({ type: 'user', id: `du-${u?.id || idx}`, item: u })),
        { type: 'title', id: 'discover-posts', label: 'Trending Posts' },
        ...discoverPosts.map((p, idx) => ({ type: 'post', id: `dp-${p?.id || idx}`, item: p })),
        { type: 'title', id: 'discover-tournaments', label: 'Tournaments' },
        ...discoverTournaments.map((t, idx) => ({ type: 'tournament', id: `dt-${t?.id || idx}`, item: t })),
      ];
    }

    return [
      { type: 'title', id: 'search-users', label: `Users (${users.length})` },
      ...users.map((u, idx) => ({ type: 'user', id: `su-${u?.id || idx}`, item: u })),
      { type: 'title', id: 'search-posts', label: `Posts (${posts.length})` },
      ...posts.map((p, idx) => ({ type: 'post', id: `sp-${p?.id || idx}`, item: p })),
    ];
  }, [discoverPosts, discoverTournaments, discoverUsers, isSearching, posts, users]);

  return (
    <FlatList
      data={listData}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            if (isSearching) {
              runSearch();
              setRefreshing(false);
              return;
            }
            loadDiscovery({ silent: true });
          }}
          colors={['#0f766e']}
        />
      }
      ListHeaderComponent={
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>Search</Text>
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'discover' ? styles.tabActive : null]}
              onPress={() => setActiveTab('discover')}
            >
              <Text style={[styles.tabText, activeTab === 'discover' ? styles.tabTextActive : null]}>Discover</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'users' ? styles.tabActive : null]}
              onPress={() => setActiveTab('users')}
            >
              <Text style={[styles.tabText, activeTab === 'users' ? styles.tabTextActive : null]}>Users</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'posts' ? styles.tabActive : null]}
              onPress={() => setActiveTab('posts')}
            >
              <Text style={[styles.tabText, activeTab === 'posts' ? styles.tabTextActive : null]}>Posts</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.searchRow}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search users or posts"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              returnKeyType="search"
              onSubmitEditing={runSearch}
            />
            <TouchableOpacity style={styles.searchButton} onPress={runSearch}>
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>
          {activeTab === 'users' ? (
            <View style={styles.filterRow}>
              <TextInput
                value={userFilters.position}
                onChangeText={(v) => setUserFilters((f) => ({ ...f, position: v }))}
                placeholder="Position"
                placeholderTextColor="#94a3b8"
                style={styles.filterInput}
              />
              <TextInput
                value={userFilters.club}
                onChangeText={(v) => setUserFilters((f) => ({ ...f, club: v }))}
                placeholder="Club"
                placeholderTextColor="#94a3b8"
                style={styles.filterInput}
              />
            </View>
          ) : null}
          {activeTab === 'posts' ? (
            <View style={styles.filterRow}>
              <TextInput
                value={postFilters.dateRange}
                onChangeText={(v) => setPostFilters((f) => ({ ...f, dateRange: v }))}
                placeholder="DateRange: all/today/week/month/year"
                placeholderTextColor="#94a3b8"
                style={styles.filterInput}
              />
              <TextInput
                value={postFilters.minLikes}
                onChangeText={(v) => setPostFilters((f) => ({ ...f, minLikes: v }))}
                placeholder="Min likes"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                style={styles.filterInput}
              />
            </View>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      }
      renderItem={({ item }) => {
        if (item.type === 'title') {
          return <Text style={styles.sectionTitle}>{item.label}</Text>;
        }

        if (item.type === 'user') {
          const user = item.item || {};
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('PublicProfile', { userId: user.id })}
              disabled={!user?.id}
            >
              <Text style={styles.cardTitle}>{`${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown User'}</Text>
              <Text style={styles.cardMeta}>Role: {user.role || 'user'}</Text>
            </TouchableOpacity>
          );
        }

        if (item.type === 'tournament') {
          const t = item.item || {};
          return (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t.name || 'Tournament'}</Text>
              <Text style={styles.cardMeta}>Type: {t.type || '-'}</Text>
              <Text style={styles.cardMeta}>Status: {t.status || '-'}</Text>
            </View>
          );
        }

        const post = item.item || {};
        return (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{`${post?.User?.firstName || post?.author?.firstName || 'User'} ${post?.User?.lastName || post?.author?.lastName || ''}`.trim()}</Text>
            <Text style={styles.cardBody}>{post.content || 'No content'}</Text>
          </View>
        );
      }}
      ListEmptyComponent={!loading ? <Text style={styles.empty}>No results found.</Text> : null}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 14, paddingBottom: 30, backgroundColor: '#f8fafc', minHeight: '100%' },
  headerCard: {
    backgroundColor: '#ecfeff',
    borderWidth: 1,
    borderColor: '#a5f3fc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  headerTitle: { color: '#0f172a', fontWeight: '800', fontSize: 20, marginBottom: 10 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tabBtn: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
    backgroundColor: '#f0f9ff',
  },
  tabActive: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  tabText: { color: '#155e75', fontWeight: '700' },
  tabTextActive: { color: '#fff' },
  searchRow: { flexDirection: 'row', gap: 8 },
  filterRow: { marginTop: 8, gap: 8 },
  filterInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
    color: '#0f172a',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    color: '#0f172a',
  },
  searchButton: {
    backgroundColor: '#0f766e',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  searchButtonText: { color: '#fff', fontWeight: '700' },
  sectionTitle: { color: '#0f172a', fontWeight: '800', marginBottom: 8, marginTop: 8 },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  cardTitle: { color: '#0f172a', fontWeight: '700' },
  cardMeta: { color: '#475569', marginTop: 4 },
  cardBody: { color: '#334155', marginTop: 6 },
  error: { color: '#b91c1c', marginTop: 8 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 20 },
});
