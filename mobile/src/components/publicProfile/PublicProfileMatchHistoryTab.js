import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { parseProfileJsonArray } from '../../utils/profileArrays';

function resultStyle(result, theme) {
  const r = String(result || '').toLowerCase();
  if (r === 'win' || r === 'w') {
    return { bg: '#dcfce7', text: '#15803d' };
  }
  if (r === 'draw' || r === 'd') {
    return { bg: '#fef9c3', text: '#a16207' };
  }
  if (r === 'loss' || r === 'l' || r === 'defeat') {
    return { bg: '#fee2e2', text: '#b91c1c' };
  }
  return { bg: theme.chipBg, text: theme.muted };
}

export default function PublicProfileMatchHistoryTab({ profile, theme }) {
  const matches = useMemo(
    () => parseProfileJsonArray(profile?.matches),
    [profile?.matches]
  );

  if (!matches.length) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: theme.muted }]}>No match history yet.</Text>
      </View>
    );
  }

  return (
    <View>
      {matches.map((match, idx) => {
        const rs = resultStyle(match?.result, theme);
        const opponent = match?.opponent || match?.awayTeam || match?.vs || 'Opponent';
        const date = match?.date || match?.matchDate || '';
        const score = match?.score != null && match?.score !== '' ? String(match.score) : '';
        const resultLabel = match?.result ? String(match.result) : '';
        const rating = Number(match?.rating);
        const ratingPct = Number.isFinite(rating) ? Math.min(100, Math.max(0, (rating / 10) * 100)) : null;

        return (
          <View
            key={String(match?.id ?? idx)}
            style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.dateLine, { color: theme.text }]} numberOfLines={2}>
                {date ? `${date} · ` : ''}vs {opponent}
              </Text>
              {(resultLabel || score) ? (
                <View style={[styles.resultBadge, { backgroundColor: rs.bg }]}>
                  <Text style={[styles.resultText, { color: rs.text }]}>
                    {[resultLabel, score].filter(Boolean).join(' ')}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.statsRow}>
              <Text style={[styles.stat, { color: theme.muted }]}>
                Goals: <Text style={{ fontWeight: '800', color: theme.text }}>{match?.goals ?? 0}</Text>
              </Text>
              <Text style={[styles.stat, { color: theme.muted }]}>
                Assists: <Text style={{ fontWeight: '800', color: theme.text }}>{match?.assists ?? 0}</Text>
              </Text>
              <Text style={[styles.stat, { color: theme.muted }]}>
                Min: <Text style={{ fontWeight: '800', color: theme.text }}>{match?.minutes ?? match?.minutesPlayed ?? '—'}</Text>
              </Text>
            </View>
            {ratingPct != null ? (
              <View style={styles.ratingRow}>
                <Text style={[styles.ratingLabel, { color: theme.muted }]}>Rating</Text>
                <View style={[styles.ratingTrack, { backgroundColor: theme.chipBg }]}>
                  <View style={[styles.ratingFill, { width: `${ratingPct}%` }]} />
                </View>
                <Text style={[styles.ratingValue, { color: theme.text }]}>{rating}</Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: 28, alignItems: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center' },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  dateLine: { flex: 1, fontSize: 15, fontWeight: '700' },
  resultBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  resultText: { fontSize: 12, fontWeight: '800' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  stat: { fontSize: 14 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  ratingLabel: { fontSize: 12, width: 44 },
  ratingTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  ratingFill: { height: '100%', backgroundColor: '#22c55e', borderRadius: 4 },
  ratingValue: { fontWeight: '800', fontSize: 14, minWidth: 28, textAlign: 'right' },
});
