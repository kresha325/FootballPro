import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  createVideoCallRequest,
  extractErrorMessage,
  followStatusRequest,
  followUserRequest,
  getOrCreateConversationRequest,
  profileByIdRequest,
  startAudioCallRequest,
  unfollowUserRequest,
} from '../api/client';

export default function PublicProfileScreen({ route, navigation }) {
  const { userId } = route.params;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadProfile = useCallback(async ({ silent } = { silent: false }) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [profileRes, followRes] = await Promise.all([
        profileByIdRequest(userId),
        followStatusRequest(userId),
      ]);
      const response = profileRes;
      setProfile(response.data || null);
      setFollowing(!!(followRes?.data?.isFollowing || followRes?.data?.following));
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load profile'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  const onToggleFollow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (following) {
        await unfollowUserRequest(userId);
        setFollowing(false);
      } else {
        await followUserRequest(userId);
        setFollowing(true);
      }
      await loadProfile({ silent: true });
    } catch (err) {
      Alert.alert('Follow action failed', extractErrorMessage(err, 'Could not update follow status'));
    } finally {
      setBusy(false);
    }
  };

  const onSendMessage = async () => {
    try {
      const res = await getOrCreateConversationRequest(userId);
      const conversationId = res?.data?.id;
      if (!conversationId) {
        throw new Error('Conversation could not be created');
      }
      navigation.navigate('Messages', {
        screen: 'Conversation',
        params: { conversationId },
      });
    } catch (err) {
      Alert.alert('Message error', extractErrorMessage(err, 'Could not open conversation'));
    }
  };

  const onAudioCall = async () => {
    try {
      const res = await startAudioCallRequest(userId);
      Alert.alert('Audio call', `Call started. ID: ${res?.data?.id || 'N/A'}`);
    } catch (err) {
      Alert.alert('Call failed', extractErrorMessage(err, 'Could not start call'));
    }
  };

  const onVideoCall = async () => {
    try {
      const res = await createVideoCallRequest(userId);
      Alert.alert('Video call', `Video call started. ID: ${res?.data?.id || 'N/A'}`);
    } catch (err) {
      Alert.alert('Video call failed', extractErrorMessage(err, 'Could not start video call'));
    }
  };

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

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.primaryBtn} onPress={onToggleFollow} disabled={busy}>
            <Text style={styles.primaryBtnText}>{following ? 'Unfollow' : 'Follow'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={onSendMessage}>
            <Text style={styles.secondaryBtnText}>Send Message</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.callBtn} onPress={onAudioCall}>
            <Text style={styles.callBtnText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.videoBtn} onPress={onVideoCall}>
            <Text style={styles.videoBtnText}>Video Call</Text>
          </TouchableOpacity>
        </View>
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
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#0f766e', fontWeight: '700' },
  callBtn: {
    flex: 1,
    backgroundColor: '#1d4ed8',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  callBtnText: { color: '#fff', fontWeight: '700' },
  videoBtn: {
    flex: 1,
    backgroundColor: '#7c3aed',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  videoBtnText: { color: '#fff', fontWeight: '700' },
  error: { color: '#b91c1c', textAlign: 'center' },
});
