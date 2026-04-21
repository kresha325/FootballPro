import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UserProfileBrowsePager, { useBrowseColors } from '../components/UserProfileBrowsePager';
import { extractErrorMessage, profilesRequest } from '../api/client';

export default function BrowseProfilesScreen({ navigation }) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = useBrowseColors(isDark);

  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadProfiles = useCallback(async ({ silent, query } = { silent: false, query: '' }) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const response = await profilesRequest({ limit: 80, search: query || undefined });
      setItems(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load profiles'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const onSearch = () => {
    loadProfiles({ silent: true, query: search.trim() });
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={styles.headerBlock}>
        <View style={styles.searchWrap}>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: colors.inputBg,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search name, club, city..."
            placeholderTextColor={colors.muted}
            onSubmitEditing={onSearch}
          />
          <TouchableOpacity style={styles.searchBtn} onPress={onSearch} accessibilityLabel="Search">
            <Ionicons name="search" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <UserProfileBrowsePager
        data={items}
        colors={colors}
        onOpenProfile={(userId) => navigation.navigate('PublicProfile', { userId })}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          loadProfiles({ silent: true, query: search.trim() });
        }}
        emptyMessage="No profiles found."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBlock: {
    paddingBottom: 4,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    marginRight: 10,
  },
  searchBtn: {
    backgroundColor: '#0f766e',
    borderRadius: 12,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { color: '#b91c1c', textAlign: 'center', marginBottom: 8, paddingHorizontal: 12 },
});
