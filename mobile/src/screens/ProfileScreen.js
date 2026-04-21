import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { extractErrorMessage, joncoinBalanceRequest, myProfileRequest } from '../api/client';

export default function ProfileScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [joncoinBalance, setJoncoinBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadProfile = useCallback(async ({ silent } = { silent: false }) => {
    if (!silent) {
      setLoading(true);
    }
    setError('');

    try {
      const [profileRes, balanceRes] = await Promise.all([
        myProfileRequest(),
        joncoinBalanceRequest().catch(() => ({ data: {} })),
      ]);
      const p = profileRes.data || null;
      setProfile(p);
      const fromProfile = p?.joncoinBalance;
      const fromApi = balanceRes?.data?.balance;
      const n =
        fromProfile != null && fromProfile !== ''
          ? Number(fromProfile)
          : fromApi != null && fromApi !== ''
            ? Number(fromApi)
            : null;
      setJoncoinBalance(Number.isFinite(n) ? n : 0);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load profile'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
        <Text style={styles.name}>
          {(profile?.firstName || '').trim()} {(profile?.lastName || '').trim()}
        </Text>
        {joncoinBalance != null ? (
          <View style={styles.joncoinWrap}>
            <Text style={styles.joncoinLabel}>JonCoin</Text>
            <Text style={styles.joncoinValue}>{joncoinBalance}</Text>
          </View>
        ) : null}
        <Text style={styles.role}>Role: {profile?.role || 'N/A'}</Text>
        <Text style={styles.row}>Email: {profile?.email || 'N/A'}</Text>
        <Text style={styles.row}>City: {profile?.city || 'N/A'}</Text>
        <Text style={styles.row}>Country: {profile?.country || 'N/A'}</Text>
        <Text style={styles.row}>Club: {profile?.club || 'N/A'}</Text>
        <Text style={styles.row}>Followers: {profile?.followers || 0}</Text>
        <Text style={styles.row}>Following: {profile?.following || 0}</Text>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('EditProfile')}>
            <Text style={styles.primaryButtonText}>Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('BrowseProfiles')}>
            <Text style={styles.secondaryButtonText}>Browse Profiles</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.publicProfileButton}
          onPress={() => {
            const uid = profile?.id ?? profile?.userId;
            if (uid == null) return;
            navigation.navigate('PublicProfile', { userId: uid });
          }}
          disabled={profile == null || (profile?.id == null && profile?.userId == null)}
        >
          <Text style={styles.publicProfileButtonText}>View public profile</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  joncoinWrap: {
    marginTop: 10,
    marginBottom: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  joncoinLabel: { color: '#92400e', fontWeight: '700', fontSize: 12 },
  joncoinValue: { color: '#b45309', fontWeight: '800', fontSize: 22, marginTop: 2 },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  role: {
    marginTop: 6,
    marginBottom: 14,
    color: '#0f766e',
    fontWeight: '600',
  },
  row: {
    marginBottom: 8,
    color: '#334155',
  },
  error: {
    color: '#b91c1c',
    textAlign: 'center',
  },
  actions: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  publicProfileButton: {
    marginTop: 12,
    borderWidth: 2,
    borderColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
  },
  publicProfileButtonText: {
    color: '#0f766e',
    fontWeight: '800',
    fontSize: 15,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  secondaryButtonText: {
    color: '#0f766e',
    fontWeight: '700',
  },
});
