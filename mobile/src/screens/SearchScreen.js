import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  extractErrorMessage,
  followingListRequest,
  searchSuggestionsRequest,
  searchUsersRequest,
} from '../api/client';
import AdvancedSearchInput from '../components/AdvancedSearchInput';
import UserProfileBrowsePager, { useBrowseColors } from '../components/UserProfileBrowsePager';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

function mapFollowingRows(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((row) => {
      const u = row?.following || row;
      if (!u?.id) return null;
      return {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        verified: u.verified,
        profilePhoto: u.Profile?.profilePhoto || u.profilePhoto || null,
        club: u.Profile?.club || u.club || null,
        position: u.Profile?.position || u.position || null,
        city: u.Profile?.city || u.city || null,
        country: u.Profile?.country || u.country || null,
      };
    })
    .filter(Boolean);
}

function mapSearchUsers(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((u) => {
      if (!u?.id) return null;
      const p = u.Profile || u.profile || {};
      return {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        verified: u.verified,
        profilePhoto: p.profilePhoto || u.profilePhoto || null,
        club: p.club || u.club || null,
        position: p.position || u.position || null,
        city: p.city || u.city || null,
        country: p.country || u.country || null,
      };
    })
    .filter(Boolean);
}

export default function SearchScreen({ navigation, route }) {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const browseColors = useBrowseColors(isDark);
  const initialQuery = route?.params?.initialQuery || '';

  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState({ position: '', club: '' });
  const [following, setFollowing] = useState([]);
  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState({ users: [], positions: [], clubs: [] });
  const [loadingFollowing, setLoadingFollowing] = useState(true);
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
        setLoadingFollowing(false);
        return;
      }
      if (!silent) setLoadingFollowing(true);
      setError('');
      try {
        const res = await followingListRequest(user.id);
        setFollowing(mapFollowingRows(res?.data));
      } catch (err) {
        setError(extractErrorMessage(err, 'Nuk u ngarkuan ndjekjet'));
        setFollowing([]);
      } finally {
        setLoadingFollowing(false);
        setRefreshing(false);
      }
    },
    [user?.id]
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
    loadFollowing();
  }, [loadFollowing]);

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

  const browseItems = useMemo(
    () => (isSearching ? results : following),
    [isSearching, results, following]
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    if (isSearching) {
      runUserSearch(query, filters, { silent: true });
    } else {
      loadFollowing({ silent: true });
    }
  }, [isSearching, query, filters, runUserSearch, loadFollowing]);

  const onApplyFilter = useCallback((patch) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const showInitialLoader = loadingFollowing && !refreshing && !isSearching && following.length === 0;

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

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!isSearching ? (
        <Text style={[styles.sectionLabel, { color: browseColors.muted }]}>Duke ndjekur</Text>
      ) : (
        <Text style={[styles.sectionLabel, { color: browseColors.muted }]}>
          {searching ? 'Duke kërkuar…' : `Rezultate${browseItems.length ? ` · ${browseItems.length}` : ''}`}
        </Text>
      )}

      {showInitialLoader ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0f766e" />
        </View>
      ) : (
        <View style={styles.browseFlex}>
          <UserProfileBrowsePager
            data={browseItems}
            colors={browseColors}
            onOpenProfile={openPublicProfile}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            emptyMessage={
              isSearching
                ? 'Asnjë rezultat për këtë kërkim.'
                : 'Nuk po ndjek askënd ende. Kërko më sipër për të gjetur njerëz.'
            }
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
