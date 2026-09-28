import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from '../theme/nativeComponents';
import {
  browseUsersRequest,
  extractErrorMessage,
  followingListRequest,
  searchSuggestionsRequest,
  searchUsersRequest,
} from '../api/client';
import AdvancedSearchInput from '../components/AdvancedSearchInput';
import UserProfileBrowsePager, { normalizeBrowseUser, useBrowseColors } from '../components/UserProfileBrowsePager';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

function mapFollowingRows(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((row) => normalizeBrowseUser(row?.following || row)).filter(Boolean);
}

function mapSearchUsers(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((u) => normalizeBrowseUser(u)).filter(Boolean);
}

const MODES = [
  { id: 'following', label: 'Duke ndjekur' },
  { id: 'browse', label: 'Shfleto' },
];

export default function SearchScreen({ navigation, route }) {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const browseColors = useBrowseColors(isDark);
  const initialQuery = route?.params?.initialQuery || '';

  const [mode, setMode] = useState('following');
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState({ position: '', club: '' });
  const [following, setFollowing] = useState([]);
  const [browseUsers, setBrowseUsers] = useState([]);
  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState({ users: [], positions: [], clubs: [] });
  const [loadingList, setLoadingList] = useState(true);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const debounceRef = useRef(null);
  const suggestRef = useRef(null);
  const requestIdRef = useRef(0);

  const isSearching =
    query.trim().length > 0 || !!filters.position?.trim() || !!filters.club?.trim();

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

  const loadFollowing = useCallback(
    async ({ silent } = { silent: false }) => {
      if (!user?.id) {
        setFollowing([]);
        setLoadingList(false);
        return;
      }
      if (!silent) setLoadingList(true);
      setError('');
      try {
        const res = await followingListRequest(user.id);
        setFollowing(mapFollowingRows(res?.data));
      } catch (err) {
        setError(extractErrorMessage(err, 'Nuk u ngarkuan ndjekjet'));
        setFollowing([]);
      } finally {
        setLoadingList(false);
        setRefreshing(false);
      }
    },
    [user?.id]
  );

  const loadBrowse = useCallback(
    async ({ silent } = { silent: false }) => {
      if (!silent) setLoadingList(true);
      setError('');
      try {
        const res = await browseUsersRequest({ limit: 40 });
        const rows = Array.isArray(res?.data) ? res.data : res?.data?.users || [];
        setBrowseUsers(mapSearchUsers(rows));
      } catch (err) {
        setError(extractErrorMessage(err, 'Nuk u ngarkuan përdoruesit'));
        setBrowseUsers([]);
      } finally {
        setLoadingList(false);
        setRefreshing(false);
      }
    },
    []
  );

  const runUserSearch = useCallback(
    async (q, nextFilters, { silent } = { silent: false }) => {
      const term = String(q || '').trim();
      const position = String(nextFilters?.position || '').trim();
      const club = String(nextFilters?.club || '').trim();
      if (!term && !position && !club) {
        setResults([]);
        setSearching(false);
        return;
      }

      const rid = ++requestIdRef.current;
      if (!silent) setSearching(true);
      setError('');
      try {
        const res = await searchUsersRequest({
          q: term || undefined,
          position: position || undefined,
          club: club || undefined,
          limit: 40,
        });
        if (rid !== requestIdRef.current) return;
        const users = res?.data?.users ?? res?.data ?? [];
        setResults(mapSearchUsers(users));
      } catch (err) {
        if (rid !== requestIdRef.current) return;
        setError(extractErrorMessage(err, 'Kërkimi dështoi'));
        setResults([]);
      } finally {
        if (rid === requestIdRef.current) {
          setSearching(false);
          setRefreshing(false);
        }
      }
    },
    []
  );

  const loadSuggestions = useCallback(async (q) => {
    const term = String(q || '').trim();
    if (term.length < 2) {
      setSuggestions({ users: [], positions: [], clubs: [] });
      return;
    }
    try {
      const res = await searchSuggestionsRequest({ q: term, type: 'all' });
      const data = res?.data || {};
      setSuggestions({
        users: Array.isArray(data.users) ? data.users : [],
        positions: Array.isArray(data.positions) ? data.positions : [],
        clubs: Array.isArray(data.clubs) ? data.clubs : [],
      });
    } catch {
      setSuggestions({ users: [], positions: [], clubs: [] });
    }
  }, []);

  useEffect(() => {
    if (mode === 'browse') loadBrowse();
    else loadFollowing();
  }, [mode, loadBrowse, loadFollowing]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (suggestRef.current) clearTimeout(suggestRef.current);

    const term = query.trim();
    const hasFilters = !!filters.position?.trim() || !!filters.club?.trim();

    if (!term && !hasFilters) {
      setResults([]);
      setSuggestions({ users: [], positions: [], clubs: [] });
      setSearching(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      runUserSearch(query, filters);
    }, 320);

    suggestRef.current = setTimeout(() => {
      loadSuggestions(query);
    }, 220);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (suggestRef.current) clearTimeout(suggestRef.current);
    };
  }, [query, filters, runUserSearch, loadSuggestions]);

  useEffect(() => {
    if (initialQuery.trim()) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  const browseItems = useMemo(() => {
    if (isSearching) return results;
    return mode === 'browse' ? browseUsers : following;
  }, [isSearching, results, mode, browseUsers, following]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    if (isSearching) {
      runUserSearch(query, filters, { silent: true });
    } else if (mode === 'browse') {
      loadBrowse({ silent: true });
    } else {
      loadFollowing({ silent: true });
    }
  }, [isSearching, mode, query, filters, runUserSearch, loadBrowse, loadFollowing]);

  const onApplyFilter = useCallback((patch) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const showInitialLoader = loadingList && !refreshing && !isSearching && browseItems.length === 0;

  const sectionLabel = isSearching
    ? searching
      ? 'Duke kërkuar…'
      : `Rezultate${browseItems.length ? ` · ${browseItems.length}` : ''}`
    : mode === 'browse'
      ? 'Shfleto · njerëz që nuk i ndjek'
      : 'Duke ndjekur';

  const emptyMessage = isSearching
    ? 'Asnjë rezultat për këtë kërkim.'
    : mode === 'browse'
      ? 'Nuk ka përdorues të rinj për t’u shfletuar tani.'
      : 'Nuk po ndjek askënd ende. Hap Shfleto ose kërko më sipër.';

  return (
    <View style={[styles.root, { backgroundColor: browseColors.bg }]}>
      <AdvancedSearchInput
        value={query}
        onChangeText={setQuery}
        onSubmit={(term) => {
          if (!term && !filters.position && !filters.club) {
            setResults([]);
            return;
          }
          runUserSearch(term, filters);
        }}
        onSelectUser={(u) => openPublicProfile(u.id)}
        onApplyFilter={onApplyFilter}
        filters={filters}
        suggestions={suggestions}
        loading={searching && isSearching}
        colors={browseColors}
      />

      {!isSearching ? (
        <View style={[styles.modeRow, { backgroundColor: browseColors.inputBg, borderColor: browseColors.border }]}>
          {MODES.map((m) => {
            const active = mode === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.modeBtn, active && { backgroundColor: '#9A6B12' }]}
                onPress={() => setMode(m.id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.modeTxt, { color: active ? '#fff' : browseColors.muted }]}>{m.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={[styles.sectionLabel, { color: browseColors.muted }]}>{sectionLabel}</Text>

      {showInitialLoader ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#9A6B12" />
        </View>
      ) : (
        <View style={styles.browseFlex}>
          <UserProfileBrowsePager
            data={browseItems}
            colors={browseColors}
            onOpenProfile={openPublicProfile}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            emptyMessage={emptyMessage}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  browseFlex: { flex: 1, minHeight: 0 },
  modeRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 4,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  modeTxt: { fontWeight: '800', fontSize: 13 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  error: {
    color: '#b91c1c',
    marginHorizontal: 16,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '600',
  },
});
