import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from '../theme/nativeComponents';
import {
  aiScoutSummaryRequest,
  extractErrorMessage,
  scoutingAddShortlistRequest,
  scoutingAddWatchlistRequest,
  scoutingCompareRequest,
  scoutingCreateReportRequest,
  scoutingPlayersRequest,
  scoutingRemoveReportRequest,
  scoutingRemoveShortlistRequest,
  scoutingRemoveWatchlistRequest,
  scoutingReportsRequest,
  scoutingShortlistRequest,
  scoutingUpdateShortlistRequest,
  scoutingWatchlistRequest,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { hasTier } from '../utils/subscriptionAccess';

const MODES = [
  ['discover', 'Zbulimi'],
  ['shortlist', 'Shortlist'],
  ['watchlist', 'Watchlist'],
  ['reports', 'Raporte'],
  ['compare', 'Krahaso'],
];

function scoreLine(player) {
  const global = player?.ranking?.globalPerformance?.score;
  if (player?.insufficientMatchData || global == null) return 'Pa ndeshje të mjaftueshme për pikë performance';
  const personal = player?.ranking?.scoutEvaluation?.score;
  return personal == null
    ? `Performanca ${Number(global).toFixed(1)}`
    : `Performanca ${Number(global).toFixed(1)} · Preferenca ${Number(personal).toFixed(1)}`;
}

export default function ScoutingScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const roleOk = ['scout', 'club', 'manager'].includes(String(user?.role || '').toLowerCase());
  const canUse = roleOk && hasTier(user, 'pro');
  const [mode, setMode] = useState('discover');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ q: '', position: '', minAge: '', maxAge: '', club: '', foot: '' });
  const [compareIds, setCompareIds] = useState('');
  const [compareWindow, setCompareWindow] = useState('season');
  const [comparison, setComparison] = useState(null);
  const [reportPlayerId, setReportPlayerId] = useState('');
  const [reportNotes, setReportNotes] = useState('');
  const [reportRecommendation, setReportRecommendation] = useState('WATCH');

  const load = useCallback(async ({ silent, nextPage = 1, nextMode = mode } = {}) => {
    if (!canUse) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    setError('');
    try {
      if (nextMode === 'discover') {
        const params = { page: nextPage, limit: 20 };
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params[key] = value;
        });
        const response = await scoutingPlayersRequest(params);
        setRows(response.data?.players || []);
        setTotal(Number(response.data?.total) || 0);
      } else if (nextMode === 'shortlist') {
        const response = await scoutingShortlistRequest({ page: nextPage, limit: 20 });
        setRows(response.data?.items || []);
        setTotal(Number(response.data?.total) || 0);
      } else if (nextMode === 'watchlist') {
        const response = await scoutingWatchlistRequest({ page: nextPage, limit: 20 });
        setRows(response.data?.items || []);
        setTotal(Number(response.data?.total) || 0);
      } else if (nextMode === 'reports') {
        const response = await scoutingReportsRequest({ page: nextPage, limit: 20 });
        setRows(response.data?.reports || []);
        setTotal(Number(response.data?.total) || 0);
      } else {
        setRows([]);
        setTotal(0);
      }
      setPage(nextPage);
    } catch (err) {
      setError(extractErrorMessage(err, 'Scouting nuk u ngarkua'));
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canUse, filters, mode]);

  useEffect(() => {
    load({ nextMode: mode });
  }, [mode, canUse]);

  async function act(work) {
    try {
      await work();
      load({ silent: true, nextPage: page, nextMode: mode });
    } catch (err) {
      if (err?.response?.status !== 409) Alert.alert('Scouting', extractErrorMessage(err, 'Veprimi dështoi'));
      else load({ silent: true, nextPage: page, nextMode: mode });
    }
  }

  async function compare() {
    setLoading(true);
    setError('');
    try {
      const response = await scoutingCompareRequest({ ids: compareIds, window: compareWindow });
      setComparison(response.data);
    } catch (err) {
      setComparison(null);
      setError(extractErrorMessage(err, 'Krahasimi dështoi'));
    } finally {
      setLoading(false);
    }
  }

  if (!canUse) {
    return (
      <View style={styles.centered}>
        <Text style={styles.accessTitle}>Qasja e scouting është e kufizuar</Text>
        <Text style={styles.accessText}>
          {roleOk ? 'Scouting kërkon planin Pro.' : 'Vetëm Scout, Club dhe Manager me planin Pro.'}
        </Text>
        {roleOk ? (
          <TouchableOpacity style={styles.primary} onPress={() => navigation.navigate('Premium')}>
            <Text style={styles.primaryText}>Përmirëso në Pro</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  const header = (
    <View>
      <View style={styles.tabs}>
        {MODES.map(([key, label]) => (
          <TouchableOpacity key={key} style={[styles.tab, mode === key && styles.tabOn]} onPress={() => { setMode(key); setPage(1); }}>
            <Text style={[styles.tabText, mode === key && styles.tabTextOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {mode === 'discover' ? (
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="Emri" value={filters.q} onChangeText={(q) => setFilters((current) => ({ ...current, q }))} />
          <TextInput style={styles.input} placeholder="Pozicioni" value={filters.position} onChangeText={(position) => setFilters((current) => ({ ...current, position }))} />
          <TextInput style={styles.input} placeholder="Klubi" value={filters.club} onChangeText={(club) => setFilters((current) => ({ ...current, club }))} />
          <View style={styles.row}>
            <TextInput style={[styles.input, styles.half]} placeholder="Mosha min" keyboardType="number-pad" value={filters.minAge} onChangeText={(minAge) => setFilters((current) => ({ ...current, minAge }))} />
            <TextInput style={[styles.input, styles.half]} placeholder="Mosha max" keyboardType="number-pad" value={filters.maxAge} onChangeText={(maxAge) => setFilters((current) => ({ ...current, maxAge }))} />
          </View>
          <View style={styles.row}>
            {['', 'left', 'right', 'both'].map((foot) => (
              <TouchableOpacity key={foot || 'any'} style={[styles.tab, filters.foot === foot && styles.tabOn]} onPress={() => setFilters((current) => ({ ...current, foot }))}>
                <Text style={styles.tabText}>{foot || 'Këmba'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.primary} onPress={() => load({ nextPage: 1 })}><Text style={styles.primaryText}>Filtro</Text></TouchableOpacity>
        </View>
      ) : null}
      {mode === 'reports' ? (
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="ID e lojtarit" keyboardType="number-pad" value={reportPlayerId} onChangeText={setReportPlayerId} />
          <TextInput style={styles.input} placeholder="Shënime" value={reportNotes} onChangeText={setReportNotes} />
          <View style={styles.row}>
            {['WATCH', 'SHORTLIST', 'TRIAL', 'PASS'].map((option) => (
              <TouchableOpacity key={option} style={[styles.tab, reportRecommendation === option && styles.tabOn]} onPress={() => setReportRecommendation(option)}>
                <Text style={styles.tabText}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={styles.primary}
            onPress={() => act(() => scoutingCreateReportRequest({
              playerId: Number(reportPlayerId),
              notes: reportNotes,
              recommendation: reportRecommendation,
              status: 'draft',
            }))}
          >
            <Text style={styles.primaryText}>Ruaj draft</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {mode === 'compare' ? (
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="ID, p.sh. 12,18" value={compareIds} onChangeText={setCompareIds} />
          <View style={styles.row}>
            {['season', 'career', 'last5', 'last10'].map((option) => (
              <TouchableOpacity key={option} style={[styles.tab, compareWindow === option && styles.tabOn]} onPress={() => setCompareWindow(option)}>
                <Text style={styles.tabText}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.primary} onPress={compare}><Text style={styles.primaryText}>Krahaso</Text></TouchableOpacity>
          {comparison?.players?.map((player) => (
            <Text key={player.playerId} style={styles.meta}>
              {player.playerName}: {player.stats?.sampleSize ? `${player.stats.goals} gola, ${player.stats.assists} asiste, ${player.stats.minutes} min` : 'Pa ndeshje në këtë periudhë'} ({comparison.period?.label})
            </Text>
          ))}
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.screen}>
        {header}
        <ActivityIndicator size="large" color="#9A6B12" />
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(item, index) => String(item.id || item.playerId || index)}
      contentContainerStyle={styles.content}
      ListHeaderComponent={header}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load({ silent: true, nextPage: page }); }} />}
      ListEmptyComponent={<Text style={styles.empty}>{mode === 'compare' ? 'Krahasimi përdor të njëjtën periudhë për çdo lojtar.' : 'Nuk ka të dhëna.'}</Text>}
      renderItem={({ item }) => {
        const player = item.player || item;
        const playerId = player.playerId || item.playerId;
        return (
          <View style={styles.card}>
            <Text style={styles.name}>{player.playerName || item.player?.playerName || `Lojtari ${playerId}`}</Text>
            <Text style={styles.meta}>{[player.position, player.age != null ? `${player.age}` : null, player.club].filter(Boolean).join(' · ')}</Text>
            {mode === 'discover' || item.player ? <Text style={styles.meta}>{scoreLine(player)}</Text> : null}
            {mode === 'reports' ? <Text style={styles.meta}>{item.status} · {item.recommendation || 'pa rekomandim'} · {item.overallRating == null ? 'pa notë' : `nota ${item.overallRating}`}</Text> : null}
            <View style={styles.row}>
              <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('PublicProfile', { userId: playerId })}>
                <Text style={styles.linkText}>Profili</Text>
              </TouchableOpacity>
              {mode === 'discover' ? (
                <>
                  <TouchableOpacity style={styles.linkBtn} onPress={() => act(() => scoutingAddShortlistRequest({ playerId }))}><Text style={styles.linkText}>Shortlist</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.linkBtn} onPress={() => act(() => scoutingAddWatchlistRequest({ playerId }))}><Text style={styles.linkText}>Watchlist</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.linkBtn} onPress={() => aiScoutSummaryRequest(playerId).then((response) => Alert.alert('AI', response.data?.summary || 'Pa përmbledhje')).catch((err) => Alert.alert('AI', extractErrorMessage(err, 'Dështoi')))}>
                    <Text style={styles.linkText}>AI</Text>
                  </TouchableOpacity>
                </>
              ) : null}
              {mode === 'shortlist' ? (
                <>
                  <TouchableOpacity style={styles.linkBtn} onPress={() => act(() => scoutingUpdateShortlistRequest(item.id, { status: 'WATCHING', priority: 'HIGH' }))}><Text style={styles.linkText}>Prioritet</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.linkBtn} onPress={() => act(() => scoutingRemoveShortlistRequest(item.id))}><Text style={styles.linkText}>Hiq</Text></TouchableOpacity>
                </>
              ) : null}
              {mode === 'watchlist' ? (
                <TouchableOpacity style={styles.linkBtn} onPress={() => act(() => scoutingRemoveWatchlistRequest(item.id))}><Text style={styles.linkText}>Hiq</Text></TouchableOpacity>
              ) : null}
              {mode === 'reports' ? (
                <TouchableOpacity style={styles.linkBtn} onPress={() => act(() => scoutingRemoveReportRequest(item.id))}><Text style={styles.linkText}>Fshi</Text></TouchableOpacity>
              ) : null}
            </View>
          </View>
        );
      }}
      ListFooterComponent={total > page * 20 ? (
        <TouchableOpacity style={styles.primary} onPress={() => load({ nextPage: page + 1 })}><Text style={styles.primaryText}>Faqja tjetër</Text></TouchableOpacity>
      ) : null}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  content: { padding: 14, paddingBottom: 30, backgroundColor: '#f8fafc' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  tab: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#fff' },
  tabOn: { backgroundColor: '#9A6B12', borderColor: '#9A6B12' },
  tabText: { color: '#0f172a', fontSize: 12, fontWeight: '700' },
  tabTextOn: { color: '#fff' },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, marginBottom: 10 },
  name: { color: '#0f172a', fontWeight: '800' },
  meta: { color: '#475569', marginTop: 4 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, marginBottom: 8, backgroundColor: '#fff' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  half: { flex: 1 },
  primary: { backgroundColor: '#9A6B12', borderRadius: 8, alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  primaryText: { color: '#fff', fontWeight: '700' },
  linkBtn: { marginTop: 8, borderWidth: 1, borderColor: '#9A6B12', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  linkText: { color: '#9A6B12', fontWeight: '700', fontSize: 12 },
  error: { color: '#b91c1c', marginBottom: 8 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 12 },
  accessTitle: { color: '#0f172a', fontWeight: '800', fontSize: 18, textAlign: 'center' },
  accessText: { color: '#475569', marginTop: 8, textAlign: 'center', marginBottom: 16 },
});
