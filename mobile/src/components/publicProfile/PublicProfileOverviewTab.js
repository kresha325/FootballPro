import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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

function teamTypeLabel(teamType) {
  const labels = {
    first_team: 'First team',
    men: 'Men',
    women: 'Women',
    youth: 'Youth',
    u23: 'U23',
    u21: 'U21',
    u19: 'U19',
    u17: 'U17',
    u15: 'U15',
  };
  return labels[teamType] || teamType || '';
}

function parseCareerHistory(raw) {
  if (raw == null || raw === '') return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'object') return [raw];
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (_e) {
    return null;
  }
}

function StatGrid({ cards, theme }) {
  if (!cards.length) return null;
  return (
    <View style={styles.statGrid}>
      {cards.map((c) => (
        <View
          key={c.key}
          style={[styles.statCard, { backgroundColor: theme.chipBg, borderColor: theme.border }]}
        >
          <Text style={[styles.statValue, { color: c.color }]}>{c.value}</Text>
          <Text style={[styles.statLabel, { color: theme.muted }]}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
}

function Section({ title, theme, children }) {
  if (!children) return null;
  return (
    <View style={[styles.box, { borderColor: theme.border, backgroundColor: theme.chipBg }]}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function ChipList({ items, theme }) {
  if (!items?.length) return null;
  return (
    <View style={styles.chipWrap}>
      {items.map((item, idx) => (
        <View key={`${item}-${idx}`} style={[styles.tag, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.tagText, { color: theme.text }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function athleteDisplayName(member) {
  const athlete = member?.athlete || member?.User || member?.user || {};
  const profile = athlete?.Profile || athlete?.profile || {};
  const name = `${athlete?.firstName || ''} ${athlete?.lastName || ''}`.trim();
  return name || 'Player';
}

function athleteUserId(member) {
  const athlete = member?.athlete || member?.User || member?.user || {};
  return athlete?.id ?? member?.athleteId ?? member?.userId ?? null;
}

function ClubSquadSection({ members, theme, onPressUser }) {
  const grouped = useMemo(() => {
    const map = {};
    (members || []).forEach((m) => {
      const team = m?.teamType ? teamTypeLabel(m.teamType) : null;
      const age = m?.athlete?.Profile?.ageGroup || m?.athlete?.profile?.ageGroup || 'Squad';
      const key = team || age;
      if (!map[key]) map[key] = [];
      map[key].push(m);
    });
    return Object.entries(map);
  }, [members]);

  if (!members?.length) {
    return <Text style={[styles.muted, { color: theme.muted }]}>No approved squad members yet.</Text>;
  }

  return (
    <View>
      {grouped.map(([group, list]) => (
        <View key={group} style={styles.groupBlock}>
          <Text style={[styles.groupTitle, { color: theme.text }]}>{group}</Text>
          {list.map((m) => {
            const uid = athleteUserId(m);
            const position = m?.position || m?.athlete?.Profile?.position || '—';
            const jersey = m?.jerseyNumber ?? m?.athlete?.Profile?.stats?.jerseyNumber;
            return (
              <TouchableOpacity
                key={String(m.id || uid || athleteDisplayName(m))}
                style={[styles.listRow, { borderColor: theme.border, backgroundColor: theme.card }]}
                onPress={() => uid != null && onPressUser?.(uid)}
                disabled={uid == null || !onPressUser}
              >
                <Text style={[styles.listTitle, { color: theme.text }]}>{athleteDisplayName(m)}</Text>
                <Text style={[styles.listMeta, { color: theme.muted }]}>
                  {position}
                  {jersey != null && jersey !== '' ? ` · #${jersey}` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function StaffListSection({ staff, theme }) {
  if (!staff?.length) {
    return <Text style={[styles.muted, { color: theme.muted }]}>No active staff listed.</Text>;
  }
  return (
    <View>
      {staff.map((s) => {
        const person = s?.staff || s?.User || {};
        const name = `${person?.firstName || ''} ${person?.lastName || ''}`.trim() || 'Staff';
        return (
          <View key={String(s.id)} style={[styles.listRow, { borderColor: theme.border, backgroundColor: theme.card }]}>
            <Text style={[styles.listTitle, { color: theme.text }]}>{name}</Text>
            <Text style={[styles.listMeta, { color: theme.muted }]}>
              {staffRoleLabel(s.staffRole)}
              {s.teamType ? ` · ${teamTypeLabel(s.teamType)}` : ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function PublicProfileOverviewTab({
  profile,
  theme,
  staffAssignments = [],
  clubMembers = [],
  clubStaff = [],
  onPressUser,
}) {
  if (!profile) return null;

  const stats = profile.stats && typeof profile.stats === 'object' ? profile.stats : {};
  const role = String(profile.role || '').toLowerCase();
  const careerItems = parseCareerHistory(profile.careerHistory);
  const careerText =
    careerItems == null && profile.careerHistory != null && profile.careerHistory !== ''
      ? typeof profile.careerHistory === 'object'
        ? JSON.stringify(profile.careerHistory, null, 2)
        : String(profile.careerHistory)
      : null;

  const athletePhysicalCards = [];
  if (stats.height != null && String(stats.height) !== '') {
    athletePhysicalCards.push({ key: 'h', label: 'Height', value: `${stats.height} cm`, color: '#2563eb' });
  }
  if (stats.weight != null && String(stats.weight) !== '') {
    athletePhysicalCards.push({ key: 'w', label: 'Weight', value: `${stats.weight} kg`, color: '#16a34a' });
  }
  if (stats.jerseyNumber != null && String(stats.jerseyNumber) !== '') {
    athletePhysicalCards.push({ key: 'j', label: 'Jersey', value: `#${stats.jerseyNumber}`, color: '#9333ea' });
  }
  if (stats.preferredFoot) {
    athletePhysicalCards.push({
      key: 'f',
      label: 'Foot',
      value: String(stats.preferredFoot).charAt(0).toUpperCase() + String(stats.preferredFoot).slice(1),
      color: '#ea580c',
    });
  }

  const scoutCards = [
    { key: 'y', label: 'Years', value: String(stats.yearsExperience ?? 0), color: '#2563eb' },
    { key: 'd', label: 'Discovered', value: String(stats.playersDiscovered ?? 0), color: '#16a34a' },
    { key: 's', label: 'Signed', value: String(stats.successfulSigns ?? 0), color: '#9333ea' },
    { key: 'r', label: 'Regions', value: String(stats.regionsActive ?? 0), color: '#ea580c' },
  ];

  const managerCards = [
    { key: 'y', label: 'Years', value: String(stats.yearsExperience ?? 0), color: '#2563eb' },
    { key: 'p', label: 'Players', value: String(stats.playersManaged ?? 0), color: '#16a34a' },
    { key: 'd', label: 'Deals', value: String(stats.dealsNegotiated ?? 0), color: '#9333ea' },
    { key: 'v', label: 'Value', value: stats.totalValue != null ? `${stats.totalValue}` : '—', color: '#ea580c' },
  ];

  const refereeCards = [
    { key: 'y', label: 'Years', value: String(stats.yearsExperience ?? 0), color: '#2563eb' },
    { key: 'm', label: 'Matches', value: String(stats.matchesOfficiated ?? 0), color: '#16a34a' },
    { key: 'c', label: 'Certs', value: String(stats.certifications ?? 0), color: '#9333ea' },
    { key: 'l', label: 'Level', value: stats.currentLevel != null ? String(stats.currentLevel) : '—', color: '#ea580c' },
  ];

  const hasRoleContent =
    (role === 'athlete' && (athletePhysicalCards.length || profile.position || profile.club)) ||
    role === 'scout' ||
    role === 'manager' ||
    role === 'referee' ||
    role === 'club' ||
    role === 'coach' ||
    role === 'trajner' ||
    ['business', 'media', 'federation'].includes(role) ||
    careerItems?.length ||
    careerText;

  return (
    <View style={styles.wrap}>
      {profile.bio ? (
        <View style={{ marginBottom: 16 }}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Bio</Text>
          <Text style={[styles.bio, { color: theme.muted }]}>{profile.bio}</Text>
        </View>
      ) : null}

      {role === 'athlete' ? (
        <>
          {(profile.position || profile.club) ? (
            <Section title="Player" theme={theme}>
              {profile.position ? (
                <Text style={[styles.line, { color: theme.muted }]}>
                  <Text style={{ fontWeight: '700', color: theme.text }}>Position: </Text>
                  {profile.position}
                </Text>
              ) : null}
              {profile.club ? (
                <Text style={[styles.line, { color: theme.muted }]}>
                  <Text style={{ fontWeight: '700', color: theme.text }}>Club: </Text>
                  {profile.club}
                </Text>
              ) : null}
              {profile.age != null ? (
                <Text style={[styles.line, { color: theme.muted }]}>
                  <Text style={{ fontWeight: '700', color: theme.text }}>Age: </Text>
                  {profile.age}
                  {profile.ageGroup ? ` (${profile.ageGroup})` : ''}
                </Text>
              ) : null}
            </Section>
          ) : null}
          <StatGrid cards={athletePhysicalCards} theme={theme} />
        </>
      ) : null}

      {role === 'scout' ? (
        <>
          <StatGrid cards={scoutCards} theme={theme} />
          <ChipList items={stats.specializations} theme={theme} />
          <ChipList items={stats.regions} theme={theme} />
          {stats.successRate != null ? (
            <Text style={[styles.line, { color: theme.muted, marginTop: 8 }]}>
              Success rate: <Text style={{ fontWeight: '700', color: theme.text }}>{stats.successRate}%</Text>
            </Text>
          ) : null}
        </>
      ) : null}

      {role === 'manager' ? (
        <>
          <StatGrid cards={managerCards} theme={theme} />
          {Array.isArray(stats.currentClients) && stats.currentClients.length > 0 ? (
            <Section title="Current clients" theme={theme}>
              {stats.currentClients.map((c, idx) => (
                <Text key={String(idx)} style={[styles.line, { color: theme.muted }]}>
                  • {typeof c === 'object' ? c.name || JSON.stringify(c) : String(c)}
                </Text>
              ))}
            </Section>
          ) : null}
        </>
      ) : null}

      {role === 'referee' ? <StatGrid cards={refereeCards} theme={theme} /> : null}

      {role === 'club' ? (
        <>
          <Section title="Club info" theme={theme}>
            {profile.club ? (
              <Text style={[styles.line, { color: theme.muted }]}>
                <Text style={{ fontWeight: '700', color: theme.text }}>Name: </Text>
                {profile.club}
              </Text>
            ) : null}
            {stats.founded ? (
              <Text style={[styles.line, { color: theme.muted }]}>
                <Text style={{ fontWeight: '700', color: theme.text }}>Founded: </Text>
                {stats.founded}
              </Text>
            ) : null}
            {stats.stadium ? (
              <Text style={[styles.line, { color: theme.muted }]}>
                <Text style={{ fontWeight: '700', color: theme.text }}>Stadium: </Text>
                {stats.stadium}
              </Text>
            ) : null}
            {stats.league ? (
              <Text style={[styles.line, { color: theme.muted }]}>
                <Text style={{ fontWeight: '700', color: theme.text }}>League: </Text>
                {stats.league}
              </Text>
            ) : null}
          </Section>
          <Section title={`Squad (${clubMembers.length})`} theme={theme}>
            <ClubSquadSection members={clubMembers} theme={theme} onPressUser={onPressUser} />
          </Section>
          <Section title="Staff" theme={theme}>
            <StaffListSection staff={clubStaff} theme={theme} />
          </Section>
        </>
      ) : null}

      {(role === 'coach' || role === 'trajner') && (profile.coachCategory || profile.coachAffiliation) ? (
        <Section title="Coach" theme={theme}>
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
        </Section>
      ) : null}

      {(role === 'coach' || role === 'trajner') && staffAssignments.length > 0 ? (
        <Section title="Club assignments" theme={theme}>
          {staffAssignments.map((a) => {
            const clubUser = a.club || a.Club;
            const clubName =
              clubUser?.Profile?.club || `${clubUser?.firstName || ''} ${clubUser?.lastName || ''}`.trim() || 'Club';
            return (
              <View
                key={String(a.id)}
                style={[styles.listRow, { borderColor: theme.border, backgroundColor: theme.card }]}
              >
                <Text style={[styles.listTitle, { color: theme.text }]}>{clubName}</Text>
                <Text style={[styles.listMeta, { color: theme.muted }]}>
                  {staffRoleLabel(a.staffRole || a.role)}
                  {a.teamType ? ` · ${teamTypeLabel(a.teamType)}` : ''}
                  {a.status ? ` · ${a.status}` : ''}
                </Text>
              </View>
            );
          })}
        </Section>
      ) : null}

      {['business', 'media', 'federation'].includes(role) ? (
        <Section title="Organization" theme={theme}>
          {stats.industry ? (
            <Text style={[styles.line, { color: theme.muted }]}>
              <Text style={{ fontWeight: '700', color: theme.text }}>Industry: </Text>
              {stats.industry}
            </Text>
          ) : null}
          {stats.employees != null && String(stats.employees) !== '' ? (
            <Text style={[styles.line, { color: theme.muted }]}>
              <Text style={{ fontWeight: '700', color: theme.text }}>Employees: </Text>
              {stats.employees}
            </Text>
          ) : null}
          {stats.partnerships != null && String(stats.partnerships) !== '' ? (
            <Text style={[styles.line, { color: theme.muted }]}>
              <Text style={{ fontWeight: '700', color: theme.text }}>Partnerships: </Text>
              {stats.partnerships}
            </Text>
          ) : null}
          {stats.countries != null && String(stats.countries) !== '' ? (
            <Text style={[styles.line, { color: theme.muted }]}>
              <Text style={{ fontWeight: '700', color: theme.text }}>Countries: </Text>
              {stats.countries}
            </Text>
          ) : null}
          {stats.founded ? (
            <Text style={[styles.line, { color: theme.muted }]}>
              <Text style={{ fontWeight: '700', color: theme.text }}>Founded: </Text>
              {stats.founded}
            </Text>
          ) : null}
        </Section>
      ) : null}

      {careerItems?.length ? (
        <Section title="Career" theme={theme}>
          {careerItems.map((item, idx) => {
            if (typeof item !== 'object' || item == null) {
              return (
                <Text key={String(idx)} style={[styles.line, { color: theme.muted }]}>
                  • {String(item)}
                </Text>
              );
            }
            const title = item.club || item.name || item.organization || 'Entry';
            const sub = [item.role, item.period, item.position].filter(Boolean).join(' · ');
            return (
              <View key={String(idx)} style={[styles.listRow, { borderColor: theme.border, backgroundColor: theme.card }]}>
                <Text style={[styles.listTitle, { color: theme.text }]}>{title}</Text>
                {sub ? <Text style={[styles.listMeta, { color: theme.muted }]}>{sub}</Text> : null}
              </View>
            );
          })}
        </Section>
      ) : null}

      {careerText ? (
        <Section title="Career notes" theme={theme}>
          <Text style={[styles.career, { color: theme.muted, borderColor: theme.border }]}>{careerText}</Text>
        </Section>
      ) : null}

      {!profile.bio && !hasRoleContent ? (
        <Text style={[styles.fallback, { color: theme.muted }]}>
          No overview details yet. Check About or other tabs for more info.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '800', marginBottom: 8 },
  bio: { fontSize: 15, lineHeight: 22 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 8 },
  statCard: {
    width: '48%',
    minWidth: 140,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 4, fontWeight: '600' },
  box: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 12 },
  line: { fontSize: 14, marginTop: 6, lineHeight: 20 },
  listRow: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 8 },
  listTitle: { fontWeight: '700', fontSize: 15 },
  listMeta: { fontSize: 13, marginTop: 4 },
  groupBlock: { marginBottom: 10 },
  groupTitle: { fontWeight: '800', fontSize: 14, marginBottom: 6, opacity: 0.85 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  tag: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: { fontSize: 13, fontWeight: '600' },
  career: { fontSize: 13, lineHeight: 20, padding: 12, borderRadius: 10, borderWidth: 1 },
  muted: { fontSize: 14, fontStyle: 'italic' },
  fallback: { fontSize: 14, lineHeight: 20, textAlign: 'center', paddingVertical: 24 },
});
