import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  groupMatchesByRound,
  isMatchWinnerSide,
  knockoutRoundLabel,
} from '../utils/tournamentBracket';

function participantLabel(p, participantType) {
  const club = p?.Profile?.club;
  const name = [p?.firstName, p?.lastName].filter(Boolean).join(' ').trim();
  if (!p?.id && !name) return 'TBD';
  if (participantType === 'club') return name || club || `Club #${p?.id}`;
  if (club && name) return `${name} (${club})`;
  return name || `User #${p?.id}`;
}

function BracketMatchCard({ match, participantType, onPress }) {
  const homeWin = isMatchWinnerSide(match, 'home');
  const awayWin = isMatchWinnerSide(match, 'away');
  const score =
    match.scoreHome != null && match.scoreAway != null
      ? `${match.scoreHome} : ${match.scoreAway}`
      : 'vs';

  return (
    <TouchableOpacity
      style={styles.matchCard}
      onPress={() => onPress?.(match)}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={[styles.teamRow, homeWin && styles.teamRowWinner]}>
        <Text style={[styles.teamName, homeWin && styles.teamNameWinner]} numberOfLines={2}>
          {participantLabel(match.homeUser, participantType)}
        </Text>
        {match.scoreHome != null ? (
          <Text style={[styles.teamScore, homeWin && styles.teamScoreWinner]}>{match.scoreHome}</Text>
        ) : null}
      </View>
      <View style={styles.scoreMid}>
        <Text style={styles.scoreMidText}>{score}</Text>
        <Text style={styles.statusText}>{match.status || 'scheduled'}</Text>
      </View>
      <View style={[styles.teamRow, awayWin && styles.teamRowWinner]}>
        <Text style={[styles.teamName, awayWin && styles.teamNameWinner]} numberOfLines={2}>
          {participantLabel(match.awayUser, participantType)}
        </Text>
        {match.scoreAway != null ? (
          <Text style={[styles.teamScore, awayWin && styles.teamScoreWinner]}>{match.scoreAway}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function TournamentBracketView({ rounds, participantType = 'individual', onMatchPress }) {
  if (!rounds?.length) {
    return (
      <Text style={styles.empty}>
        Bracket is empty. Start the tournament or generate bracket to create round 1 matches.
      </Text>
    );
  }

  const roundNumbers = rounds.map((r) => r.round);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
      {rounds.map(({ round, matches: roundMatches }) => (
        <View key={String(round)} style={styles.roundCol}>
          <Text style={styles.roundTitle}>{knockoutRoundLabel(round, roundNumbers)}</Text>
          {roundMatches.map((m) => (
            <BracketMatchCard
              key={String(m.id)}
              match={m}
              participantType={participantType}
              onPress={onMatchPress}
            />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

export { groupMatchesByRound };

const styles = StyleSheet.create({
  hScroll: { paddingVertical: 4, paddingRight: 12, gap: 12 },
  roundCol: { width: 220, marginRight: 12 },
  roundTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f766e',
    textAlign: 'center',
    marginBottom: 10,
  },
  matchCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  teamRowWinner: { backgroundColor: '#dcfce7' },
  teamName: { flex: 1, fontSize: 13, color: '#334155', fontWeight: '600', marginRight: 6 },
  teamNameWinner: { color: '#14532d', fontWeight: '800' },
  teamScore: { fontSize: 16, fontWeight: '800', color: '#64748b', minWidth: 24, textAlign: 'right' },
  teamScoreWinner: { color: '#15803d' },
  scoreMid: { alignItems: 'center', paddingVertical: 4 },
  scoreMidText: { fontSize: 12, fontWeight: '700', color: '#94a3b8' },
  statusText: { fontSize: 10, color: '#94a3b8', textTransform: 'capitalize', marginTop: 2 },
  empty: { color: '#64748b', lineHeight: 20 },
});
