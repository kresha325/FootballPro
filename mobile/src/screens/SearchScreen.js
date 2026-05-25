import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import {
  extractErrorMessage,
  recommendedUsersRequest,
  searchEverythingRequest,
  searchPostsRequest,
  searchUsersRequest,
  trendingSearchPostsRequest,
  trendingSearchUsersRequest,
} from '../api/client';
import UserProfileBrowsePager, { useBrowseColors } from '../components/UserProfileBrowsePager';

function dedupeUsersById(list) {
  const seen = new Set();
  const out = [];
  for (const u of list) {
    if (u && u.id != null && !seen.has(u.id)) {
      seen.add(u.id);
      out.push(u);
    }
  }
  return out;
}

const EXTRA_TABS = [
  { id: 'all', label: 'All' },
  { id: 'tournaments', label: 'Cups' },
  { id: 'products', label: 'Shop' },
  { id: 'streams', label: 'Live' },
  { id: 'videos', label: 'Video' },
  { id: 'matches', label: 'Matches' },
];

export default function SearchScreen({ navigation, route }) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const browseColors = useBrowseColors(isDark);
  const initialQuery = route?.params?.initialQuery || '';

  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState(initialQuery ? 'all' : 'discover');
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
  const [tournaments, setTournaments] = useState([]);
  const [products, setProducts] = useState([]);
  const [streams, setStreams] = useState([]);
  const [videos, setVideos] = useState([]);
  const [matches, setMatches] = useState([]);

  const isSearching = query.trim().length > 0 || (activeTab !== 'discover' && activeTab !== 'all');
  const showUserBrowse = activeTab === 'discover' || activeTab === 'users';

  const openPublicProfile = useCallback(
    (id) => {
      if (id == null) return;
      const tabNav = navigation.getParent?.();
      if (tabNav?.navigate) {
        tabNav.navigate('Profile', { screen: 'PublicProfile', params: { userId: id } });
      } else {
        navigation.navigate('PublicProfile', { userId: id });
      }
    },
    [navigation]
  );

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

      const mergedUsers = dedupeUsersById([
        ...(Array.isArray(recommended) ? recommended : []),
        ...(Array.isArray(trendingUsers) ? trendingUsers : []),
      ]).slice(0, 24);

      setDiscoverUsers(mergedUsers);
      setDiscoverPosts(Array.isArray(trendingPosts) ? trendingPosts.slice(0, 12) : []);
      setDiscoverTournaments(Array.isArray(universalTournaments) ? universalTournaments.slice(0, 12) : []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not load discovery'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const runSearch = useCallback(
    async ({ silent } = { silent: false }) => {
      const q = query.trim();
      if (!silent) setLoading(true);
      setError('');
      try {
        if (!q && activeTab !== 'discover') {
          setError('Type a query first');
          return;
        }
        if (!q && activeTab === 'discover') {
          setUsers([]);
          setPosts([]);
          return;
        }
        if (activeTab === 'users') {
          const usersRes = await searchUsersRequest({ q, ...userFilters });
          setUsers(Array.isArray(usersRes?.data?.users) ? usersRes.data.users : []);
          setPosts([]);
          setTournaments([]);
          setProducts([]);
          setStreams([]);
          setVideos([]);
          setMatches([]);
        } else if (activeTab === 'posts') {
          const postsRes = await searchPostsRequest({ q, ...postFilters });
          setPosts(Array.isArray(postsRes?.data?.posts) ? postsRes.data.posts : []);
          setUsers([]);
          setTournaments([]);
          setProducts([]);
          setStreams([]);
          setVideos([]);
          setMatches([]);
        } else {
          const res = await searchEverythingRequest({ q });
          const data = res?.data || {};
          setUsers(Array.isArray(data.users) ? data.users : []);
          setPosts(Array.isArray(data.posts) ? data.posts : []);
          setTournaments(Array.isArray(data.tournaments) ? data.tournaments : []);
          setProducts(Array.isArray(data.products) ? data.products : []);
          setStreams(Array.isArray(data.streams) ? data.streams : []);
          setVideos(Array.isArray(data.videos) ? data.videos : []);
          setMatches(Array.isArray(data.matches) ? data.matches : []);
        }
      } catch (err) {
        setError(extractErrorMessage(err, 'Search failed'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeTab, postFilters, query, userFilters]
  );

  useEffect(() => {
    loadDiscovery();
  }, [loadDiscovery]);

  useEffect(() => {
    if (initialQuery.trim()) {
      runSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const browseUserItems = useMemo(() => {
    if (activeTab === 'discover') return discoverUsers;
    if (activeTab === 'users') return users;
    return [];
  }, [activeTab, discoverUsers, users]);

  const postsForList = useMemo(() => {
    if (!isSearching) return discoverPosts;
    return posts;
  }, [isSearching, discoverPosts, posts]);

  const handleBrowseRefresh = useCallback(() => {
    setRefreshing(true);
    if (activeTab === 'discover') {
      loadDiscovery({ silent: true });
    } else {
      runSearch({ silent: true });
    }
  }, [activeTab, loadDiscovery, runSearch]);

  const ListHeader = (
    <View style={[styles.headerCard, { borderColor: browseColors.border, backgroundColor: browseColors.inputBg }]}>
      <Text style={[styles.headerTitle, { color: browseColors.text }]}>Search</Text>
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            { borderColor: browseColors.border, backgroundColor: browseColors.bg },
            activeTab === 'discover' && styles.tabActive,
          ]}
          onPress={() => setActiveTab('discover')}
        >
          <Text style={[styles.tabText, { color: browseColors.text }, activeTab === 'discover' && styles.tabTextActive]}>
            Discover
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            { borderColor: browseColors.border, backgroundColor: browseColors.bg },
            activeTab === 'users' && styles.tabActive,
          ]}
          onPress={() => setActiveTab('users')}
        >
          <Text style={[styles.tabText, { color: browseColors.text }, activeTab === 'users' && styles.tabTextActive]}>
            Users
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            { borderColor: browseColors.border, backgroundColor: browseColors.bg },
            activeTab === 'posts' && styles.tabActive,
          ]}
          onPress={() => setActiveTab('posts')}
        >
          <Text style={[styles.tabText, { color: browseColors.text }, activeTab === 'posts' && styles.tabTextActive]}>
            Posts
          </Text>
        </TouchableOpacity>
        {EXTRA_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tabBtn,
              { borderColor: browseColors.border, backgroundColor: browseColors.bg },
              activeTab === tab.id && styles.tabActive,
            ]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, { color: browseColors.text }, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Kërko përdorues, postime, turne, shop…"
          placeholderTextColor={browseColors.muted}
          style={[
            styles.input,
            { borderColor: browseColors.border, backgroundColor: browseColors.card, color: browseColors.text },
          ]}
          returnKeyType="search"
          onSubmitEditing={() => runSearch()}
        />
        <TouchableOpacity style={styles.searchButton} onPress={() => runSearch()}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>
      {activeTab === 'users' ? (
        <View style={styles.filterRow}>
          <TextInput
            value={userFilters.position}
            onChangeText={(v) => setUserFilters((f) => ({ ...f, position: v }))}
            placeholder="Position"
            placeholderTextColor={browseColors.muted}
            style={[
              styles.filterInput,
              { borderColor: browseColors.border, backgroundColor: browseColors.card, color: browseColors.text },
            ]}
          />
          <TextInput
            value={userFilters.club}
            onChangeText={(v) => setUserFilters((f) => ({ ...f, club: v }))}
            placeholder="Club"
            placeholderTextColor={browseColors.muted}
            style={[
              styles.filterInput,
              { borderColor: browseColors.border, backgroundColor: browseColors.card, color: browseColors.text },
            ]}
          />
        </View>
      ) : null}
      {activeTab === 'posts' ? (
        <View style={styles.filterRow}>
          <TextInput
            value={postFilters.dateRange}
            onChangeText={(v) => setPostFilters((f) => ({ ...f, dateRange: v }))}
            placeholder="DateRange: all/today/week/month/year"
            placeholderTextColor={browseColors.muted}
            style={[
              styles.filterInput,
              { borderColor: browseColors.border, backgroundColor: browseColors.card, color: browseColors.text },
            ]}
          />
          <TextInput
            value={postFilters.minLikes}
            onChangeText={(v) => setPostFilters((f) => ({ ...f, minLikes: v }))}
            placeholder="Min likes"
            placeholderTextColor={browseColors.muted}
            keyboardType="numeric"
            style={[
              styles.filterInput,
              { borderColor: browseColors.border, backgroundColor: browseColors.card, color: browseColors.text },
            ]}
          />
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );

  const DiscoverStrip =
    activeTab === 'discover' && (discoverPosts.length > 0 || discoverTournaments.length > 0) ? (
      <View style={[styles.stripWrap, { backgroundColor: browseColors.bg, borderBottomColor: browseColors.border }]}>
        <Text style={[styles.stripTitle, { color: browseColors.muted }]}>Trending & tournaments</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stripScroll}>
          {discoverTournaments.map((t) => (
            <View key={`t-${t.id}`} style={[styles.stripChip, { borderColor: browseColors.border, backgroundColor: browseColors.card }]}>
              <Text style={[styles.stripChipTitle, { color: browseColors.text }]} numberOfLines={1}>
                {t.name || 'Tournament'}
              </Text>
              <Text style={[styles.stripChipMeta, { color: browseColors.muted }]}>{t.status || ''}</Text>
            </View>
          ))}
          {discoverPosts.map((p) => (
            <View key={`p-${p.id}`} style={[styles.stripChip, styles.stripChipWide, { borderColor: browseColors.border, backgroundColor: browseColors.card }]}>
              <Text style={[styles.stripChipBody, { color: browseColors.text }]} numberOfLines={2}>
                {p.content || 'Post'}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
    ) : null;

  if (loading && !refreshing && showUserBrowse && browseUserItems.length === 0 && activeTab === 'discover') {
    return (
      <View style={[styles.centered, { backgroundColor: browseColors.bg }]}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  if (showUserBrowse) {
    return (
      <View style={[styles.root, { backgroundColor: browseColors.bg }]}>
        {ListHeader}
        {DiscoverStrip}
        <View style={styles.browseFlex}>
          {loading && !refreshing && activeTab === 'users' ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#0f766e" />
            </View>
          ) : (
            <UserProfileBrowsePager
              data={browseUserItems}
              colors={browseColors}
              onOpenProfile={openPublicProfile}
              refreshing={refreshing}
              onRefresh={handleBrowseRefresh}
              emptyMessage={
                activeTab === 'users'
                  ? 'Search with the bar above or adjust filters.'
                  : 'No suggested people yet.'
              }
            />
          )}
        </View>
      </View>
    );
  }

  const entityTabs = new Set(['all', 'tournaments', 'products', 'streams', 'videos', 'matches']);
  if (entityTabs.has(activeTab)) {
    const show = (key) => activeTab === 'all' || activeTab === key;
    const sections = [];
    if (show('users') && users.length) sections.push({ title: 'Users', items: users, type: 'user' });
    if (show('posts') && posts.length) sections.push({ title: 'Posts', items: posts, type: 'post' });
    if (show('tournaments') && tournaments.length) sections.push({ title: 'Tournaments', items: tournaments, type: 'tournament' });
    if (show('products') && products.length) sections.push({ title: 'Shop', items: products, type: 'product' });
    if (show('streams') && streams.length) sections.push({ title: 'Streams', items: streams, type: 'stream' });
    if (show('videos') && videos.length) sections.push({ title: 'Videos', items: videos, type: 'video' });
    if (show('matches') && matches.length) sections.push({ title: 'Matches', items: matches, type: 'match' });

    return (
      <ScrollView
        style={[styles.root, { backgroundColor: browseColors.bg }]}
        contentContainerStyle={styles.postsContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                if (query.trim()) await runSearch({ silent: true });
              } finally {
                setRefreshing(false);
              }
            }}
            colors={['#0f766e']}
          />
        }
      >
        {ListHeader}
        {loading && !refreshing ? (
          <ActivityIndicator size="large" color="#0f766e" style={{ marginVertical: 24 }} />
        ) : sections.length === 0 ? (
          <Text style={[styles.empty, { color: browseColors.muted }]}>
            {query.trim() ? 'No results.' : 'Type a query and tap Search.'}
          </Text>
        ) : (
          sections.map((sec) => (
            <View key={sec.title} style={{ marginBottom: 16 }}>
              <Text style={[styles.stripTitle, { color: browseColors.text, paddingHorizontal: 0 }]}>{sec.title}</Text>
              {sec.items.map((item) => (
                <TouchableOpacity
                  key={`${sec.type}-${item.id}`}
                  style={[styles.postCard, { borderColor: browseColors.border, backgroundColor: browseColors.card }]}
                  onPress={() => {
                    if (sec.type === 'user') openPublicProfile(item.id);
                    else if (sec.type === 'tournament') navigation.navigate('TournamentDetail', { tournamentId: item.id });
                    else if (sec.type === 'stream') navigation.navigate('LiveViewer', { streamId: item.id });
                    else if (sec.type === 'video') navigation.navigate('Videos');
                    else if (sec.type === 'match') navigation.navigate('Matches');
                    else if (sec.type === 'product') navigation.navigate('Marketplace');
                  }}
                >
                  <Text style={[styles.postAuthor, { color: browseColors.text }]}>
                    {sec.type === 'user'
                      ? `${item.firstName || ''} ${item.lastName || ''}`.trim()
                      : item.name || item.title || item.content?.slice(0, 40) || 'Item'}
                  </Text>
                  {item.description || item.content ? (
                    <Text style={[styles.postBody, { color: browseColors.muted }]} numberOfLines={2}>
                      {item.description || item.content}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    );
  }

  return (
    <FlatList
      data={postsForList}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={[styles.postsContent, { backgroundColor: browseColors.bg }]}
      ListHeaderComponent={
        <View>
          {ListHeader}
        </View>
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            try {
              if (isSearching && query.trim()) {
                await runSearch({ silent: true });
              } else {
                await loadDiscovery({ silent: true });
              }
            } finally {
              setRefreshing(false);
            }
          }}
          colors={['#0f766e']}
        />
      }
      renderItem={({ item: post }) => (
        <View style={[styles.postCard, { borderColor: browseColors.border, backgroundColor: browseColors.card }]}>
          <Text style={[styles.postAuthor, { color: browseColors.text }]}>
            {`${post?.User?.firstName || post?.author?.firstName || 'User'} ${post?.User?.lastName || post?.author?.lastName || ''}`.trim()}
          </Text>
          <Text style={[styles.postBody, { color: browseColors.muted }]}>{post.content || 'No content'}</Text>
        </View>
      )}
      ListEmptyComponent={
        !loading ? (
          <Text style={[styles.empty, { color: browseColors.muted }]}>
            {query.trim() ? 'No posts found.' : 'Pull to refresh or search.'}
          </Text>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  browseFlex: { flex: 1, minHeight: 0 },
  headerCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  headerTitle: { fontWeight: '800', fontSize: 20, marginBottom: 10 },
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  tabBtn: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  tabActive: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  tabText: { fontWeight: '700' },
  tabTextActive: { color: '#fff' },
  searchRow: { flexDirection: 'row' },
  filterRow: { marginTop: 8 },
  filterInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
  },
  searchButton: {
    backgroundColor: '#0f766e',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  searchButtonText: { color: '#fff', fontWeight: '700' },
  stripWrap: {
    paddingBottom: 10,
    marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stripTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  stripScroll: {
    paddingHorizontal: 12,
    paddingRight: 20,
  },
  stripChip: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginRight: 10,
    maxWidth: 140,
  },
  stripChipWide: {
    maxWidth: 220,
  },
  stripChipTitle: { fontWeight: '800', fontSize: 13 },
  stripChipMeta: { fontSize: 11, marginTop: 4 },
  stripChipBody: { fontSize: 13, lineHeight: 18 },
  postsContent: { padding: 14, paddingBottom: 30 },
  postCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  postAuthor: { fontWeight: '800', fontSize: 15 },
  postBody: { marginTop: 8, fontSize: 15, lineHeight: 22 },
  error: { color: '#b91c1c', marginTop: 8 },
  empty: { textAlign: 'center', marginTop: 20 },
});
