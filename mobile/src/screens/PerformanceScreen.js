import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from '../theme/nativeComponents';
import { extractErrorMessage, performanceAnalyticsRequest } from '../api/client';
import { useTheme } from '../context/ThemeContext';

const RANGES = [
  { id: '7d', label: '7 ditë' },
  { id: '30d', label: '30 ditë' },
  { id: '90d', label: '90 ditë' },
  { id: 'season', label: 'Sezoni' },
  { id: 'career', label: 'Karriera' },
];

function Tile({ label, value, colors }) {
  return (
    <View style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.value, { color: colors.text }]}>{value == null || value === '' ? '—' : String(value)}</Text>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

function Bars({ points, colors }) {
  if (!points || points.length < 2) {
    return <Text style={{ color: colors.muted }}>Duhet të paktën dy ndeshje për trendin.</Text>;
  }
  const max = Math.max(...points.map((point) => Number(point.goals) || 0), 1);
  return (
    <View style={styles.bars}>
      {points.slice(-10).map((point) => (
        <View key={String(point.matchId || point.month)} style={styles.barCol}>
          <View style={[styles.bar, { height: Math.max(6, Math.round(((Number(point.goals) || 0) / max) * 72)), backgroundColor: colors.primary }]} />
        </View>
      ))}
    </View>
  );
}

export default function PerformanceScreen() {
  const { colors } = useTheme();
  const [range, setRange] = useState('30d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await performanceAnalyticsRequest(range);
      setData(res.data);
    } catch (err) {
      setError(extractErrorMessage(err, 'Analitika nuk u ngarkua.'));
    } finally {
      setLoading(false);
    }
  }, [range]);

  React.useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const player = data?.player;
  const career = player?.career;
  const form = player?.form?.last5;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Text style={[styles.title, { color: colors.text }]}>Performanca</Text>
      <View style={styles.ranges}>
        {RANGES.map((item) => (
          <TouchableOpacity key={item.id} onPress={() => setRange(item.id)} style={[styles.range, { backgroundColor: range === item.id ? colors.primary : colors.card }]}>
            <Text style={{ color: range === item.id ? colors.onPrimary : colors.text }}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <Text style={{ color: colors.danger || '#B91C1C' }}>{error}</Text> : null}

      {player && !player.hasOfficial ? (
        <Text style={{ color: colors.muted }}>Nuk ka ndeshje zyrtare. Statistikat vijnë vetëm nga ndeshjet.</Text>
      ) : null}
      {career ? (
        <View style={styles.grid}>
          <Tile label="Ndeshje" value={career.appearances} colors={colors} />
          <Tile label="Minuta" value={career.minutes} colors={colors} />
          <Tile label="Gola" value={career.goals} colors={colors} />
          <Tile label="Asiste" value={career.assists} colors={colors} />
          <Tile label="Fitore" value={career.wins} colors={colors} />
          <Tile label="Rating" value={career.rating} colors={colors} />
        </View>
      ) : null}
      {form ? (
        <Text style={{ color: colors.text }}>5 ndeshjet e fundit: {form.goals} gola, {form.assists} asiste, rating {form.rating ?? '—'}</Text>
      ) : null}
      {player?.trends ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.section, { color: colors.text }]}>Gola në kohë</Text>
          <Bars points={player.trends.points} colors={colors} />
        </View>
      ) : null}

      {data?.scouting ? (
        <View style={styles.grid}>
          <Tile label="Shortlist" value={data.scouting.playersShortlisted} colors={colors} />
          <Tile label="Watchlist" value={data.scouting.playersWatched} colors={colors} />
          <Tile label="Raporte" value={data.scouting.reports?.completed} colors={colors} />
          <Tile label="Prospekte" value={data.scouting.activeProspects} colors={colors} />
        </View>
      ) : null}
      {data?.scoutingInterest ? (
        <View style={styles.grid}>
          <Tile label="Vlerësime" value={data.scoutingInterest.evaluations} colors={colors} />
          <Tile label="Scout-a" value={data.scoutingInterest.scouts} colors={colors} />
          <Tile label="Rating" value={data.scoutingInterest.averageScoutRating} colors={colors} />
        </View>
      ) : null}
      {data?.marketplace?.orders ? (
        <View style={styles.grid}>
          <Tile label="Porosi" value={data.marketplace.orders.orders} colors={colors} />
          <Tile label="Shitje" value={data.marketplace.orders.sales} colors={colors} />
          <Tile label="Bruto" value={data.marketplace.orders.grossRevenue} colors={colors} />
          <Tile label="Neto" value={data.marketplace.orders.netRevenue} colors={colors} />
        </View>
      ) : null}
      {data?.wallet ? (
        <View style={styles.grid}>
          <Tile label="Balanca" value={data.wallet.balance} colors={colors} />
          <Tile label="Blerë" value={data.wallet.activity?.purchased} colors={colors} />
          <Tile label="Shpenzuar" value={data.wallet.activity?.spent} colors={colors} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  ranges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  range: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '47%', borderWidth: 1, borderRadius: 12, padding: 12 },
  value: { fontSize: 20, fontWeight: '700' },
  label: { marginTop: 4, fontSize: 12 },
  card: { borderWidth: 1, borderRadius: 12, padding: 12 },
  section: { fontWeight: '700', marginBottom: 8 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 4 },
  barCol: { flex: 1, justifyContent: 'flex-end' },
  bar: { borderRadius: 4 },
});
