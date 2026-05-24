import { formatTournamentTitle } from '../../utils/footballSeason';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

function statusLabel(status) {
  const map = {
    open: 'Open',
    ongoing: 'Ongoing',
    finished: 'Finished',
    pending: 'Pending approval',
    accepted: 'Participating',
    rejected: 'Rejected',
  };
  return map[status] || status || '';
}

export default function PublicProfileTournamentsTab({
  tournaments = [],
  totals = null,
  theme,
  onPressTournament,
}) {
  const rows = Array.isArray(tournaments) ? tournaments : [];

  return (
    <View>
      {totals ? (
        <View style={[styles.totalsBox, { borderColor: theme.border, backgroundColor: theme.chipBg }]}>
          <Text style={[styles.totalsTitle, { color: theme.text }]}>Totals from tournaments</Text>
          <View style={styles.totalsGrid}>
            <View style={styles.totalItem}>
              <Text style={[styles.totalValue, { color: '#0f766e' }]}>{totals.tournamentsPlayed ?? 0}</Text>
              <Text style={[styles.totalLabel, { color: theme.muted }]}>Tournaments</Text>
            </View>
            <View style={styles.totalItem}>
              <Text style={[styles.totalValue, { color: '#0f766e' }]}>{totals.points ?? 0}</Text>
              <Text style={[styles.totalLabel, { color: theme.muted }]}>Points</Text>
            </View>
            <View style={styles.totalItem}>
              <Text style={[styles.totalValue, { color: '#0f766e' }]}>{totals.goalsFor ?? 0}</Text>
              <Text style={[styles.totalLabel, { color: theme.muted }]}>Team goals</Text>
            </View>
            <View style={styles.totalItem}>
              <Text style={[styles.totalValue, { color: '#0f766e' }]}>{totals.scorerGoals ?? 0}</Text>
              <Text style={[styles.totalLabel, { color: theme.muted }]}>Personal goals</Text>
            </View>
          </View>
        </View>
      ) : null}

      {rows.length === 0 ? (
        <Text style={[styles.empty, { color: theme.muted }]}>No tournament participation yet.</Text>
      ) : (
        rows.map((row) => (
          <TouchableOpacity
            key={String(row.tournamentId)}
            style={[styles.card, { borderColor: theme.border, backgroundColor: theme.chipBg }]}
            activeOpacity={0.85}
            onPress={() => onPressTournament?.(row.tournamentId)}
          >
            <View style={styles.cardTop}>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
                {formatTournamentTitle({
                  name: row.tournamentName,
                  season: row.tournamentSeason,
                  type: row.tournamentType,
                })}
              </Text>
              {row.rank ? (
                <Text style={styles.rank}>#{row.rank}</Text>
              ) : null}
            </View>
            <Text style={[styles.meta, { color: theme.muted }]}>
              {statusLabel(row.tournamentStatus)}
              {row.participantStatus && row.participantStatus !== 'accepted'
                ? ` · ${statusLabel(row.participantStatus)}`
                : ''}
              {row.tournamentType ? ` · ${row.tournamentType}` : ''}
            </Text>
            <View style={styles.statsRow}>
              <Text style={[styles.stat, { color: theme.text }]}>{row.points ?? 0} pts</Text>
              <Text style={[styles.stat, { color: theme.text }]}>{row.played ?? 0} pl</Text>
              <Text style={[styles.stat, { color: theme.text }]}>{row.goalsFor ?? 0} GF</Text>
              <Text style={[styles.stat, { color: theme.text }]}>{row.scorerGoals ?? 0} personal G</Text>
              <Text style={[styles.stat, { color: theme.text }]}>GD {row.goalDifference ?? 0}</Text>
            </View>
            <Text style={styles.tapHint}>Tap to open tournament</Text>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  totalsBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  totalsTitle: { fontWeight: '800', marginBottom: 10 },
  totalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  totalItem: { minWidth: '22%', alignItems: 'center' },
  totalValue: { fontSize: 20, fontWeight: '800' },
  totalLabel: { fontSize: 11, marginTop: 2, textAlign: 'center' },
  empty: { textAlign: 'center', paddingVertical: 24 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontWeight: '800', fontSize: 16 },
  rank: {
    color: '#0f766e',
    fontWeight: '800',
    fontSize: 16,
  },
  meta: { marginTop: 4, fontSize: 13 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  stat: { fontWeight: '700', fontSize: 13 },
  tapHint: { marginTop: 8, fontSize: 12, color: '#0f766e', fontWeight: '600' },
});
