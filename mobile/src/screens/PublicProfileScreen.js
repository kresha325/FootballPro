import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { extractErrorMessage, profileByIdRequest } from '../api/client';

export default function PublicProfileScreen({ route }) {
  const { userId } = route.params;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadProfile = useCallback(async ({ silent } = { silent: false }) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const response = await profileByIdRequest(userId);
      setProfile(response.data || null);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load profile'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  if (error && !profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
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
      <View style={styles.card}>
        <Text style={styles.name}>{`${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || 'Unknown user'}</Text>
        <Text style={styles.role}>Role: {profile?.role || 'N/A'}</Text>
        <Text style={styles.row}>City: {profile?.city || 'N/A'}</Text>
        <Text style={styles.row}>Country: {profile?.country || 'N/A'}</Text>
        <Text style={styles.row}>Club: {profile?.club || 'N/A'}</Text>
        <Text style={styles.row}>Position: {profile?.position || 'N/A'}</Text>
        <Text style={styles.row}>Followers: {profile?.followers || 0}</Text>
        <Text style={styles.row}>Following: {profile?.following || 0}</Text>
        <Text style={styles.bio}>{profile?.bio || 'No bio yet.'}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 16 },
  name: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  role: { marginTop: 6, marginBottom: 14, color: '#0f766e', fontWeight: '600' },
  row: { marginBottom: 8, color: '#334155' },
  bio: { marginTop: 10, color: '#334155', lineHeight: 20 },
  error: { color: '#b91c1c', textAlign: 'center' },
});
