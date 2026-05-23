import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  approveClubRosterRequest,
  clubRosterByClubRequest,
  clubRosterPendingRequest,
  clubRosterRequestsRequest,
  clubStaffByClubRequest,
  extractErrorMessage,
  rejectClubRosterRequest,
  removeClubRosterRequest,
  submitClubRosterRequest,
  updateClubStaffRequest,
} from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function ClubRosterScreen() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  const [athleteForm, setAthleteForm] = useState({ clubId: '', position: '', jerseyNumber: '', message: '' });
  const [publicRoster, setPublicRoster] = useState([]);
  const [staffActive, setStaffActive] = useState([]);
  const [staffPending, setStaffPending] = useState([]);
  const [staffSubTab, setStaffSubTab] = useState('pending');

  const isClub = user?.role === 'club';
  const isAthlete = user?.role === 'athlete';

  const loadData = useCallback(async ({ silent } = { silent: false }) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [allRes, pendingRes] = await Promise.all([clubRosterRequestsRequest(), clubRosterPendingRequest()]);
      setRequests(Array.isArray(allRes?.data) ? allRes.data : []);
      setPending(Array.isArray(pendingRes?.data) ? pendingRes.data : []);

      if (athleteForm.clubId) {
        const rosterRes = await clubRosterByClubRequest(Number(athleteForm.clubId));
        setPublicRoster(Array.isArray(rosterRes?.data) ? rosterRes.data : []);
      }

      if (isClub && user?.id && activeTab === 'staff') {
        const [activeRes, pendingRes] = await Promise.all([
          clubStaffByClubRequest(user.id, { status: 'active' }),
          clubStaffByClubRequest(user.id, { status: 'pending' }),
        ]);
        setStaffActive(Array.isArray(activeRes?.data) ? activeRes.data : []);
        setStaffPending(Array.isArray(pendingRes?.data) ? pendingRes.data : []);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not load club roster'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, athleteForm.clubId, isClub, user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const approved = useMemo(() => requests.filter((r) => r?.status === 'approved'), [requests]);
  const myRequests = useMemo(() => requests.filter((r) => r?.athleteId === user?.id), [requests, user?.id]);

  const performAction = async (fn, requestId) => {
    try {
      await fn(requestId);
      loadData({ silent: true });
    } catch (err) {
      setError(extractErrorMessage(err, 'Action failed'));
    }
  };

  const handleStaffAction = async (staffId, status) => {
    try {
      await updateClubStaffRequest(staffId, { status });
      loadData({ silent: true });
    } catch (err) {
      setError(extractErrorMessage(err, 'Staff action failed'));
    }
  };

  const handleSubmitRequest = async () => {
    if (!athleteForm.clubId || !athleteForm.position) {
      setError('clubId and position are required');
      return;
    }
    try {
      await submitClubRosterRequest({
        clubId: Number(athleteForm.clubId),
        position: athleteForm.position,
        jerseyNumber: athleteForm.jerseyNumber ? Number(athleteForm.jerseyNumber) : undefined,
        message: athleteForm.message,
      });
      setAthleteForm({ clubId: '', position: '', jerseyNumber: '', message: '' });
      loadData({ silent: true });
    } catch (err) {
      setError(extractErrorMessage(err, 'Request failed'));
    }
  };

  if (!isClub && !isAthlete) {
    return (
      <View style={styles.centered}>
        <Text style={styles.denied}>Club roster is available for club and athlete accounts.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={
        isClub
          ? activeTab === 'staff'
            ? staffSubTab === 'pending'
              ? staffPending
              : staffActive
            : activeTab === 'pending'
              ? pending
              : approved
          : activeTab === 'myRequests'
            ? myRequests
            : publicRoster
      }
      keyExtractor={(item, idx) => String(item?.id || idx)}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadData({ silent: true });
          }}
          colors={['#0f766e']}
        />
      }
      ListHeaderComponent={
        <View>
          <View style={styles.headerCard}>
            <Text style={styles.headerTitle}>Club Roster</Text>
            <Text style={styles.sub}>Pending: {pending.length} | Approved: {approved.length} | All: {requests.length}</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>

          {isClub ? (
            <View>
              <View style={styles.tabRow}>
                <TouchableOpacity
                  style={[styles.tabBtn, activeTab === 'pending' ? styles.tabActive : null]}
                  onPress={() => setActiveTab('pending')}
                >
                  <Text style={[styles.tabText, activeTab === 'pending' ? styles.tabTextActive : null]}>Pending</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tabBtn, activeTab === 'approved' ? styles.tabActive : null]}
                  onPress={() => setActiveTab('approved')}
                >
                  <Text style={[styles.tabText, activeTab === 'approved' ? styles.tabTextActive : null]}>Approved</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tabBtn, activeTab === 'staff' ? styles.tabActive : null]}
                  onPress={() => setActiveTab('staff')}
                >
                  <Text style={[styles.tabText, activeTab === 'staff' ? styles.tabTextActive : null]}>Staff</Text>
                </TouchableOpacity>
              </View>
              {activeTab === 'staff' ? (
                <View style={styles.tabRow}>
                  <TouchableOpacity
                    style={[styles.tabBtn, staffSubTab === 'pending' ? styles.tabActive : null]}
                    onPress={() => setStaffSubTab('pending')}
                  >
                    <Text style={[styles.tabText, staffSubTab === 'pending' ? styles.tabTextActive : null]}>Pending staff</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tabBtn, staffSubTab === 'active' ? styles.tabActive : null]}
                    onPress={() => setStaffSubTab('active')}
                  >
                    <Text style={[styles.tabText, staffSubTab === 'active' ? styles.tabTextActive : null]}>Active staff</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ) : (
            <View>
              <View style={styles.tabRow}>
                <TouchableOpacity
                  style={[styles.tabBtn, activeTab === 'myRequests' ? styles.tabActive : null]}
                  onPress={() => setActiveTab('myRequests')}
                >
                  <Text style={[styles.tabText, activeTab === 'myRequests' ? styles.tabTextActive : null]}>My Requests</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tabBtn, activeTab === 'clubView' ? styles.tabActive : null]}
                  onPress={() => setActiveTab('clubView')}
                >
                  <Text style={[styles.tabText, activeTab === 'clubView' ? styles.tabTextActive : null]}>Club Roster</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formCard}>
                <Text style={styles.formTitle}>Join a Club</Text>
                <TextInput
                  value={athleteForm.clubId}
                  onChangeText={(v) => setAthleteForm((f) => ({ ...f, clubId: v }))}
                  placeholder="Club ID"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  style={styles.input}
                />
                <TextInput
                  value={athleteForm.position}
                  onChangeText={(v) => setAthleteForm((f) => ({ ...f, position: v }))}
                  placeholder="Position"
                  placeholderTextColor="#94a3b8"
                  style={styles.input}
                />
                <TextInput
                  value={athleteForm.jerseyNumber}
                  onChangeText={(v) => setAthleteForm((f) => ({ ...f, jerseyNumber: v }))}
                  placeholder="Jersey Number"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  style={styles.input}
                />
                <TextInput
                  value={athleteForm.message}
                  onChangeText={(v) => setAthleteForm((f) => ({ ...f, message: v }))}
                  placeholder="Message"
                  placeholderTextColor="#94a3b8"
                  style={styles.input}
                />
                <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitRequest}>
                  <Text style={styles.submitTxt}>Submit Request</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <Text style={styles.section}>
            {isClub
              ? activeTab === 'staff'
                ? staffSubTab === 'pending'
                  ? 'Pending staff'
                  : 'Active staff'
                : activeTab === 'pending'
                  ? 'Pending Requests'
                  : 'Approved Squad'
              : activeTab === 'myRequests'
                ? 'My Requests'
                : 'Club Roster'}
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        if (isClub && activeTab === 'staff') {
          const staffUser = item?.staff || item?.User || {};
          const isPendingStaff = item?.status === 'pending';
          return (
            <View style={styles.card}>
              <Text style={styles.name}>
                {`${staffUser?.firstName || ''} ${staffUser?.lastName || ''}`.trim() || 'Staff member'}
              </Text>
              <Text style={styles.meta}>
                Role: {item?.staffRole || '—'} · Team: {item?.teamType || '—'} · {item?.status}
              </Text>
              {isPendingStaff ? (
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.action, styles.ok]}
                    onPress={() => handleStaffAction(item.id, 'active')}
                  >
                    <Text style={styles.actionText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.action, styles.warn]}
                    onPress={() => handleStaffAction(item.id, 'inactive')}
                  >
                    <Text style={styles.actionText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          );
        }

        const athlete = item?.athlete || item?.User || item?.user || {};
        const isPending = item?.status === 'pending';

        return (
          <View style={styles.card}>
            <Text style={styles.name}>{`${athlete?.firstName || ''} ${athlete?.lastName || ''}`.trim() || 'Unknown Athlete'}</Text>
            <Text style={styles.meta}>Status: {item?.status || 'pending'}</Text>

            {isClub && isPending && activeTab !== 'staff' ? (
              <View style={styles.actionsRow}>
                <TouchableOpacity style={[styles.action, styles.ok]} onPress={() => performAction(approveClubRosterRequest, item.id)}>
                  <Text style={styles.actionText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.action, styles.warn]} onPress={() => performAction(rejectClubRosterRequest, item.id)}>
                  <Text style={styles.actionText}>Reject</Text>
                </TouchableOpacity>
              </View>
            ) : isClub ? (
              <TouchableOpacity style={[styles.action, styles.remove]} onPress={() => performAction(removeClubRosterRequest, item.id)}>
                <Text style={styles.actionText}>Remove</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        );
      }}
      ListEmptyComponent={
        !loading ? (
          <Text style={styles.empty}>
            {isClub
              ? activeTab === 'staff'
                ? staffSubTab === 'pending'
                  ? 'No pending staff.'
                  : 'No active staff.'
                : activeTab === 'pending'
                ? 'No pending requests.'
                : 'No approved players.'
              : activeTab === 'myRequests'
                ? 'No requests yet.'
                : 'No club roster found for this club ID.'}
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
  sub: { color: '#155e75', marginTop: 4 },
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
  formCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  formTitle: { color: '#0f172a', fontWeight: '700', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#0f172a',
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  submitBtn: { backgroundColor: '#0f766e', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  submitTxt: { color: '#fff', fontWeight: '700' },
  section: { color: '#0f172a', fontWeight: '800', marginBottom: 8 },
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
  actionsRow: { flexDirection: 'row', gap: 8 },
  action: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center' },
  ok: { backgroundColor: '#16a34a' },
  warn: { backgroundColor: '#dc2626' },
  remove: { backgroundColor: '#64748b' },
  actionText: { color: '#fff', fontWeight: '700' },
  error: { color: '#b91c1c', marginTop: 8 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 20 },
});
