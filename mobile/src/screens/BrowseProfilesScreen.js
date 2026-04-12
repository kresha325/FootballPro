import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { extractErrorMessage, profilesRequest } from '../api/client';

function ProfileRow({ item, onPress }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <Text style={styles.name}>{`${item.firstName || ''} ${item.lastName || ''}`.trim() || 'User'}</Text>
      <Text style={styles.meta}>{item.role || 'N/A'} | {item.club || 'No club'}</Text>
      <Text style={styles.meta}>{item.position || 'No position'} | {item.city || 'No city'}</Text>
    </TouchableOpacity>
  );
}

export default function BrowseProfilesScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadProfiles = useCallback(async ({ silent, query } = { silent: false, query: '' }) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const response = await profilesRequest({ limit: 50, search: query || undefined });
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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, club, city..."
          onSubmitEditing={onSearch}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={onSearch}>
          <Text style={styles.searchText}>Search</Text>
        </TouchableOpacity>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadProfiles({ silent: true, query: search.trim() });
            }}
            colors={['#0f766e']}
          />
        }
        renderItem={({ item }) => (
          <ProfileRow
            item={item}
            onPress={() => navigation.navigate('PublicProfile', { userId: item.id })}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No profiles found.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchWrap: { flexDirection: 'row', padding: 12, gap: 8 },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  searchBtn: {
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  searchText: { color: '#fff', fontWeight: '700' },
  list: { paddingHorizontal: 12, paddingBottom: 20 },
  row: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  name: { fontWeight: '800', color: '#0f172a' },
  meta: { color: '#64748b', marginTop: 4 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 20 },
  error: { color: '#b91c1c', textAlign: 'center', marginBottom: 8 },
});
