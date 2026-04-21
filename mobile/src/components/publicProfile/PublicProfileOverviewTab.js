import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

function formatCoachCategory(cat) {
  if (!cat) return '';
  return String(cat).replace(/_/g, ' ');
}

function formatAffiliation(a) {
  const labels = {
    club: 'Club trainer',
    independent: 'Independent',
    personal_trainer: 'Personal trainer',
  };
  return labels[a] || (a ? String(a).replace(/_/g, ' ') : '');
}

function staffRoleLabel(role) {
  if (!role) return '';
  return String(role).replace(/_/g, ' ');
}

export default function PublicProfileOverviewTab({ profile, theme, staffAssignments = [] }) {
  if (!profile) return null;
  const stats = profile.stats && typeof profile.stats === 'object' ? profile.stats : {};
  const role = String(profile.role || '').toLowerCase();
  const careerText =
    profile.careerHistory != null && profile.careerHistory !== ''
      ? typeof profile.careerHistory === 'object'
        ? JSON.stringify(profile.careerHistory, null, 2)
        : String(profile.careerHistory)
      : '';

  const statCards = [];
  if (stats.height != null && String(stats.height) !== '') {
    statCards.push({ key: 'h', label: 'Height', value: `${stats.height} cm`, color: '#2563eb' });
  }
  if (stats.weight != null && String(stats.weight) !== '') {
    statCards.push({ key: 'w', label: 'Weight', value: `${stats.weight} kg`, color: '#16a34a' });
  }
  if (stats.jerseyNumber != null && String(stats.jerseyNumber) !== '') {
    statCards.push({ key: 'j', label: 'Jersey', value: `#${stats.jerseyNumber}`, color: '#9333ea' });
  }

  return (
    <View style={styles.wrap}>
      {profile.bio ? (
        <View style={{ marginBottom: 16 }}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Bio</Text>
          <Text style={[styles.bio, { color: theme.muted }]}>{profile.bio}</Text>
        </View>
      ) : null}

      {statCards.length > 0 ? (
        <View style={styles.statGrid}>
          {statCards.map((c) => (
            <View
              key={c.key}
              style={[styles.statCard, { backgroundColor: theme.chipBg, borderColor: theme.border }]}
            >
              <Text style={[styles.statValue, { color: c.color }]}>{c.value}</Text>
              <Text style={[styles.statLabel, { color: theme.muted }]}>{c.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {(role === 'coach' || role === 'trajner') && (profile.coachCategory || profile.coachAffiliation) ? (
        <View style={[styles.box, { borderColor: theme.border, backgroundColor: theme.chipBg }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Coach</Text>
          {profile.coachCategory ? (
            <Text style={[styles.line, { color: theme.muted }]}>
              <Text style={{ fontWeight: '700', color: theme.text }}>Category: </Text>
              {formatCoachCategory(profile.coachCategory)}
            </Text>
          ) : null}
          {profile.coachAffiliation ? (
            <Text style={[styles.line, { color: theme.muted }]}>
              <Text style={{ fontWeight: '700', color: theme.text }}>Affiliation: </Text>
              {formatAffiliation(profile.coachAffiliation)}
            </Text>
          ) : null}
        </View>
      ) : null}

      {(role === 'coach' || role === 'trajner') && staffAssignments.length > 0 ? (
        <View style={{ marginTop: 14 }}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Club assignments</Text>
          {staffAssignments.map((a) => {
            const clubUser = a.club || a.Club;
            const clubName =
              clubUser?.Profile?.club || `${clubUser?.firstName || ''} ${clubUser?.lastName || ''}`.trim() || 'Club';
            return (
              <View
                key={String(a.id)}
                style={[styles.assignRow, { borderColor: theme.border, backgroundColor: theme.card }]}
              >
                <Text style={[styles.assignTitle, { color: theme.text }]}>{clubName}</Text>
                <Text style={[styles.assignMeta, { color: theme.muted }]}>
                  {staffRoleLabel(a.staffRole || a.role)}
                  {a.teamType ? ` · ${a.teamType}` : ''}
                  {a.status ? ` · ${a.status}` : ''}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {careerText ? (
        <View style={{ marginTop: 14 }}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Career</Text>
          <Text style={[styles.career, { color: theme.muted, borderColor: theme.border }]}>{careerText}</Text>
        </View>
      ) : null}

      {!profile.bio && !statCards.length && !careerText && !staffAssignments.length ? (
        <Text style={[styles.fallback, { color: theme.muted }]}>
          Overview shows bio, physical stats, coach details, and club assignments when available.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '800', marginBottom: 8 },
  bio: { fontSize: 15, lineHeight: 22 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statCard: {
    width: '31%',
    minWidth: 100,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 4, fontWeight: '600' },
  box: { borderRadius: 12, borderWidth: 1, padding: 14, marginTop: 4 },
  line: { fontSize: 14, marginTop: 6, lineHeight: 20 },
  assignRow: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 8 },
  assignTitle: { fontWeight: '700', fontSize: 15 },
  assignMeta: { fontSize: 13, marginTop: 4 },
  career: { fontSize: 13, lineHeight: 20, padding: 12, borderRadius: 10, borderWidth: 1 },
  fallback: { fontSize: 14, lineHeight: 20, textAlign: 'center', paddingVertical: 24 },
});
