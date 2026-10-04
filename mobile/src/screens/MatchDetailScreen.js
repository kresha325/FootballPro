import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from '../theme/nativeComponents';
import { matchByIdRequest, extractErrorMessage } from '../api/client';

function sideName(match, side) {
  const user = side === 'home' ? match?.homeUser : match?.awayUser;
  const fallback = side === 'home' ? match?.homeName : match?.awayName;
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return name || user?.Profile?.club || fallback || (side === 'away' && !match?.awayUserId ? 'Bye' : '—');
}

export default function MatchDetailScreen({ route }) {
  const matchId = route?.params?.matchId;
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!matchId) {
      setError('Missing match');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await matchByIdRequest(matchId);
      setMatch(res?.data || null);
    } catch (err) {
      setError(extractErrorMessage(err, 'Match failed to load'));
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;
  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!match) return <Text style={styles.empty}>Match not found.</Text>;

  const events = Array.isArray(match.events) ? match.events : [];
  const scorers = Array.isArray(match.MatchScorers) ? match.MatchScorers : [];
  const stats = Array.isArray(match.playerStats) ? match.playerStats : [];

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>{match.competition?.name || 'Match'} · {match.roundLabel || match.status}</Text>
      <Text style={styles.score}>{sideName(match, 'home')}  {match.scoreHome ?? '–'} : {match.scoreAway ?? '–'}  {sideName(match, 'away')}</Text>
      <Text style={styles.meta}>{match.matchDate ? new Date(match.matchDate).toLocaleString() : 'No kickoff'}</Text>
      <Text style={styles.meta}>{match.venue || 'Venue not set'}{match.refereeName ? ` · Ref ${match.refereeName}` : ''}</Text>
      {match.clockMinute != null ? <Text style={styles.meta}>{match.clockPhase || match.status} · {match.clockMinute}'</Text> : null}
      <Text style={styles.section}>Events</Text>
      {scorers.length === 0 && events.length === 0 ? <Text style={styles.meta}>No goals, cards, or substitutions yet.</Text> : null}
      {scorers.map((row) => (
        <Text key={`s-${row.id}`} style={styles.line}>Goal #{row.userId} {row.minute != null ? `${row.minute}'` : ''}</Text>
      ))}
      {events.map((event) => (
        <Text key={event.id} style={styles.line}>
          {event.minute != null ? `${event.minute}' ` : ''}{event.type} {event.userId ? `#${event.userId}` : ''} {event.detail || ''}
        </Text>
      ))}
      <Text style={styles.section}>Player statistics</Text>
      {stats.length === 0 ? <Text style={styles.meta}>No player statistics recorded.</Text> : null}
      {stats.map((row) => (
        <Text key={row.id || row.userId} style={styles.line}>
          #{row.userId} · {row.minutes || 0} min · {row.goals || 0} goals · {row.assists || 0} assists
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16 },
  kicker: { color: '#64748b', marginBottom: 8 },
  score: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  meta: { color: '#475569', marginTop: 6 },
  section: { marginTop: 18, marginBottom: 8, fontWeight: '700', color: '#0f172a' },
  line: { color: '#0f172a', marginBottom: 6 },
  error: { color: '#b91c1c', padding: 16 },
  empty: { color: '#64748b', padding: 16 },
});
