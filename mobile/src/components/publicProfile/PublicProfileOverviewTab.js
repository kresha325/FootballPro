import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from '../../theme/nativeComponents';
import OptimizedImage from '../media/OptimizedImage';
import { absoluteBackendUrl } from '../../config/constants';
import { formatTournamentTitle } from '../../utils/footballSeason';
import { formatTotalsPoints } from '../../utils/tournamentPoints';

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

/** Build career rows from transfer history when profile.careerHistory is incomplete. */
function careerFromTransfers(transfers = [], profile = {}) {
  const list = (Array.isArray(transfers) ? transfers : [])
    .filter((t) => {
      const s = String(t?.status || 'confirmed').toLowerCase();
      return !['pending', 'rejected', 'cancelled'].includes(s);
    })
    .slice()
    .sort((a, b) => {
      const da = new Date(a.transferDate || 0).getTime();
      const db = new Date(b.transferDate || 0).getTime();
      return da - db;
    });

  const real = list.filter((t) => t.notes !== '__current_club__');
  const use = real.length ? real : list;
  const rows = [];

  if (use.length) {
    const first = use[0];
    const fromName = String(first.fromClub || '').trim();
    const firstTo = String(first.toClub || '').trim();
    if (fromName && fromName.toLowerCase() !== firstTo.toLowerCase()) {
      rows.push({ club: fromName, season: first.season || null, ongoing: false });
    }
  }

  use.forEach((t, i) => {
    const club = String(t.toClub || '').trim();
    if (!club) return;
    if (rows.length && String(rows[rows.length - 1].club).toLowerCase() === club.toLowerCase()) return;
    const ongoing = i === use.length - 1;
    rows.push({
      club,
      season: ongoing
        ? profile.clubJoinedYear
          ? `nga ${profile.clubJoinedYear} · vazhdon`
          : t.season || 'vazhdon'
        : t.season || null,
      ongoing,
    });
  });

  return rows.reverse();
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

function hasValue(value) {
  return value !== null && value !== undefined && value !== '';
}

function numberValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isVideoItem(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.type === 'video' || item.videoUrl) return true;
  const u = String(item.imageUrl || item.url || item.mediaUrl || '');
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u);
}

function mediaUri(path) {
  if (!path || typeof path !== 'string') return null;
  if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path;
  try {
    return absoluteBackendUrl(path);
  } catch (_e) {
    return path;
  }
}

function EmptyLine({ theme, children }) {
  return <Text style={[styles.emptyInline, { color: theme.muted, borderColor: theme.border }]}>{children}</Text>;
}

function Section({ title, eyebrow, theme, action, children }) {
  if (children == null) return null;
  return (
    <View style={[styles.box, { borderColor: theme.border, backgroundColor: theme.chipBg }]}>
      <View style={styles.sectionHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          {eyebrow ? (
            <Text style={[styles.eyebrow, { color: '#9A6B12' }]}>{eyebrow}</Text>
          ) : null}
          <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>{title}</Text>
        </View>
        {action || null}
      </View>
      <View style={{ marginTop: 10 }}>{children}</View>
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
  const name = `${athlete?.firstName || ''} ${athlete?.lastName || ''}`.trim();
  return name || 'Player';
}

function athleteUserId(member) {
  const athlete = member?.athlete || member?.User || member?.user || {};
  return athlete?.id ?? member?.athleteId ?? member?.userId ?? null;
}

function isAthleteMembership(member) {
  const athlete = member?.athlete || member?.User || member?.user || {};
  const role = String(athlete?.role || '').toLowerCase();
  return !role || role === 'athlete';
}

function competitionLabel(cat) {
  if (!cat) return '';
  const labels = {
    open: 'Open',
    senior: 'Senior',
    u23: 'U23',
    u21: 'U21',
    u19: 'U19',
    u17: 'U17',
    u15: 'U15',
    u13: 'U13',
    u11: 'U11',
    u10: 'U10',
    u9: 'U9',
  };
  return labels[cat] || String(cat);
}

function AvatarCircle({ uri, initials, theme }) {
  if (uri && typeof uri === 'string') {
    return <OptimizedImage uri={uri} style={styles.avatar} width={160} contentFit="cover" />;
  }
  return (
    <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.border }]}>
      <Text style={[styles.avatarInitials, { color: theme.text }]}>{initials || '?'}</Text>
    </View>
  );
}

function ClubSquadSection({ members, theme, onPressUser }) {
  const athletes = useMemo(() => (members || []).filter(isAthleteMembership), [members]);

  const grouped = useMemo(() => {
    const map = {};
    athletes.forEach((m) => {
      const key = m?.teamType ? teamTypeLabel(m.teamType) : 'Pa kategori';
      if (!map[key]) map[key] = [];
      map[key].push(m);
    });
    return Object.entries(map);
  }, [athletes]);

  if (!athletes.length) {
    return <Text style={[styles.muted, { color: theme.muted }]}>Nuk ka atletë të aprovuar ende.</Text>;
  }

  return (
    <View>
      {grouped.map(([group, list]) => (
        <View key={group} style={styles.groupBlock}>
          <Text style={[styles.groupTitle, { color: theme.text }]}>
            {group} · {list.length}
          </Text>
          {list.map((m) => {
            const uid = athleteUserId(m);
            const athlete = m?.athlete || {};
            const photo = athlete?.Profile?.profilePhoto || athlete?.profile?.profilePhoto;
            const initials = `${(athlete?.firstName || '?').charAt(0)}${(athlete?.lastName || '').charAt(0)}`.toUpperCase();
            const position = m?.position || athlete?.Profile?.position || '—';
            const jersey = m?.jerseyNumber ?? athlete?.Profile?.stats?.jerseyNumber;
            const competition = competitionLabel(m?.competitionCategory);
            const ageGroup = athlete?.Profile?.ageGroup || athlete?.profile?.ageGroup;
            return (
              <TouchableOpacity
                key={String(m.id || uid || athleteDisplayName(m))}
                style={[styles.listRow, styles.personRow, { borderColor: theme.border, backgroundColor: theme.card }]}
                onPress={() => uid != null && onPressUser?.(uid)}
                disabled={uid == null || !onPressUser}
                activeOpacity={0.75}
              >
                <AvatarCircle uri={photo} initials={initials} theme={theme} />
                <View style={styles.personMeta}>
                  <Text style={[styles.listTitle, { color: theme.text }]}>{athleteDisplayName(m)}</Text>
                  <Text style={[styles.listMeta, { color: theme.muted }]}>
                    {[
                      'Atlet',
                      competition ? `Ligë: ${competition}` : null,
                      ageGroup,
                      position,
                      jersey != null && jersey !== '' ? `#${jersey}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function StaffListSection({ staff, theme, onPressUser }) {
  const grouped = useMemo(() => {
    const map = {};
    (staff || []).forEach((s) => {
      const key = s?.teamType ? teamTypeLabel(s.teamType) : 'Pa kategori';
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return Object.entries(map);
  }, [staff]);

  if (!staff?.length) {
    return <Text style={[styles.muted, { color: theme.muted }]}>Nuk ka staf aktiv ende.</Text>;
  }

  return (
    <View>
      {grouped.map(([group, list]) => (
        <View key={group} style={styles.groupBlock}>
          <Text style={[styles.groupTitle, { color: theme.text }]}>
            {group} · {list.length}
          </Text>
          {list.map((s) => {
            const person = s?.staff || s?.User || {};
            const uid = person?.id ?? s?.staffId ?? null;
            const name = `${person?.firstName || ''} ${person?.lastName || ''}`.trim() || 'Staff';
            const photo = person?.Profile?.profilePhoto || person?.profile?.profilePhoto;
            const initials = `${(person?.firstName || '?').charAt(0)}${(person?.lastName || '').charAt(0)}`.toUpperCase();
            return (
              <TouchableOpacity
                key={String(s.id)}
                style={[styles.listRow, styles.personRow, { borderColor: theme.border, backgroundColor: theme.card }]}
                onPress={() => uid != null && onPressUser?.(uid)}
                disabled={uid == null || !onPressUser}
                activeOpacity={0.75}
              >
                <AvatarCircle uri={photo} initials={initials} theme={theme} />
                <View style={styles.personMeta}>
                  <Text style={[styles.listTitle, { color: theme.text }]}>{name}</Text>
                  <Text style={[styles.listMeta, { color: theme.muted }]}>
                    {[staffRoleLabel(s.staffRole) || 'Staff', s.teamType ? teamTypeLabel(s.teamType) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export default function PublicProfileOverviewTab({
  profile,
  theme,
  staffAssignments = [],
  clubMembers = [],
  clubStaff = [],
  transfers = [],
  onPressUser,
  tournamentSummary = null,
  gallery = [],
  videos = [],
  onOpenTab,
}) {
  const stats = profile?.stats && typeof profile.stats === 'object' ? profile.stats : {};
  const role = String(profile?.role || '').toLowerCase();
  const isAthlete = role === 'athlete';
  const tournaments = Array.isArray(tournamentSummary?.tournaments) ? tournamentSummary.tournaments : [];
  const totals = tournamentSummary?.totals || {};
  const matches = Array.isArray(profile?.matches) ? profile.matches : [];
  const achievements = Array.isArray(profile?.achievements) ? profile.achievements : [];

  const highlightVideos = useMemo(() => {
    const fromGallery = (Array.isArray(gallery) ? gallery : []).filter(isVideoItem);
    if (fromGallery.length) return fromGallery;
    return Array.isArray(videos) ? videos : [];
  }, [gallery, videos]);

  if (!profile) return null;

  let careerItems = parseCareerHistory(profile.careerHistory);
  const fromTransfers = careerFromTransfers(transfers, profile);
  if (fromTransfers.length > (careerItems?.length || 0)) {
    careerItems = fromTransfers;
  }
  const joinedYearRaw = Number(profile.clubJoinedYear);
  const joinedYear =
    Number.isFinite(joinedYearRaw) &&
    joinedYearRaw >= 1950 &&
    joinedYearRaw <= new Date().getFullYear() + 1
      ? joinedYearRaw
      : null;
  if ((!careerItems || !careerItems.length) && profile.club && joinedYear) {
    careerItems = [
      {
        club: profile.club,
        season: `nga ${joinedYear} · vazhdon`,
        ongoing: true,
      },
    ];
  }
  const careerText =
    careerItems == null && profile.careerHistory != null && profile.careerHistory !== ''
      ? typeof profile.careerHistory === 'object'
        ? JSON.stringify(profile.careerHistory, null, 2)
        : String(profile.careerHistory)
      : null;

  const official = profile?.statisticsSource === 'matches' ? profile?.performance?.career : null;
  const numericAppearances = numberValue(official?.appearances);
  const tournamentAppearances = tournaments.reduce((sum, item) => sum + (numberValue(item.played) || 0), 0);
  const appearances = numericAppearances ?? (official ? null : tournaments.length ? tournamentAppearances : null);
  const goals = numberValue(official?.goals);
  const assists = numberValue(official?.assists);
  const minutes = numberValue(official?.minutes);
  const performanceCards = [
    { key: 'nd', label: 'Ndeshje', value: appearances, color: '#9A6B12' },
    { key: 'g', label: 'Gola', value: goals, color: '#9A6B12' },
    { key: 'a', label: 'Asiste', value: assists, color: '#9A6B12' },
    { key: 'm', label: 'Minuta', value: minutes, color: '#9A6B12' },
    { key: 'p', label: 'Pikë', value: totals && (totals.points != null || totals.pointsPossible != null) ? formatTotalsPoints(totals) : null, color: '#9A6B12' },
    { key: 't', label: 'Turne', value: numberValue(totals.tournamentsPlayed), color: '#9A6B12' },
  ].filter((c) => c.value !== null);

  const identityRows = [
    ['Pozicioni', profile?.position],
    ['Këmba e preferuar', stats.preferredFoot],
    ['Gjatësia', hasValue(stats.height) ? `${stats.height} cm` : null],
    ['Pesha', hasValue(stats.weight) ? `${stats.weight} kg` : null],
    ['Numri', hasValue(stats.jerseyNumber) ? `#${stats.jerseyNumber}` : null],
    ['Mosha', profile?.age != null ? `${profile.age}${profile.ageGroup ? ` (${profile.ageGroup})` : ''}` : null],
    ['Shtetësia', profile?.country],
    ['Qyteti', profile?.city],
    ['Klubi aktual', profile?.club],
    ['Ekipi', stats.currentTeam],
    ['Agjenti', stats.agentName],
  ].filter(([, value]) => hasValue(value));

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
    (isAthlete &&
      (performanceCards.length ||
        identityRows.length ||
        careerItems?.length ||
        careerText ||
        matches.length ||
        achievements.length ||
        tournaments.length ||
        highlightVideos.length ||
        profile.bio)) ||
    role === 'scout' ||
    role === 'manager' ||
    role === 'referee' ||
    role === 'club' ||
    role === 'coach' ||
    role === 'trajner' ||
    ['business', 'media', 'federation'].includes(role) ||
    (!isAthlete && (careerItems?.length || careerText));

  return (
    <View style={styles.wrap}>
      {isAthlete && profile.completeness?.percent != null ? (
        <Text style={[styles.bio, { color: theme.muted, marginBottom: 12 }]}>
          Plotësia e profilit: {profile.completeness.percent}%
          {profile.verificationStatus ? ` · ${profile.verificationStatus}` : ''}
        </Text>
      ) : null}

      {profile.bio ? (
        <View style={{ marginBottom: 16 }}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Bio</Text>
          <Text style={[styles.bio, { color: theme.muted }]}>{profile.bio}</Text>
        </View>
      ) : null}

      {isAthlete ? (
        <>
          <Section title="Performanca" eyebrow="Përmbledhje e karrierës" theme={theme}>
            {performanceCards.length ? (
              <StatGrid cards={performanceCards} theme={theme} />
            ) : (
              <EmptyLine theme={theme}>
                Statistikat e ndeshjeve do të shfaqen këtu kur të jenë të disponueshme.
              </EmptyLine>
            )}
          </Section>

          <Section title="Identiteti i lojtarit" eyebrow="Të dhënat kryesore" theme={theme}>
            {identityRows.length ? (
              <View style={styles.identityGrid}>
                {identityRows.map(([label, value]) => {
                  const isClub = label === 'Klubi aktual' && profile.clubId && onPressUser;
                  const cell = (
                    <>
                      <Text style={[styles.identityLabel, { color: theme.muted }]}>{label}</Text>
                      <Text
                        style={[
                          styles.identityValue,
                          { color: theme.text },
                          isClub ? { textDecorationLine: 'underline', color: '#9A6B12' } : null,
                        ]}
                      >
                        {value}
                      </Text>
                    </>
                  );
                  if (isClub) {
                    return (
                      <TouchableOpacity
                        key={label}
                        style={[styles.identityCell, { borderBottomColor: theme.border }]}
                        onPress={() => onPressUser(profile.clubId)}
                        activeOpacity={0.75}
                      >
                        {cell}
                      </TouchableOpacity>
                    );
                  }
                  return (
                    <View key={label} style={[styles.identityCell, { borderBottomColor: theme.border }]}>
                      {cell}
                    </View>
                  );
                })}
              </View>
            ) : (
              <EmptyLine theme={theme}>Informacioni i lojtarit nuk është shtuar ende.</EmptyLine>
            )}
          </Section>

          <Section title="Karriera" eyebrow="Klube dhe sezone" theme={theme}>
            {careerItems?.length ? (
              careerItems.map((item, idx) => {
                if (typeof item !== 'object' || item == null) {
                  return (
                    <Text key={String(idx)} style={[styles.line, { color: theme.muted }]}>
                      • {String(item)}
                    </Text>
                  );
                }
                const title = item.club || item.clubName || item.team || item.name || item.competition || 'Klub';
                const showLineStats = (careerItems?.length || 0) > 1;
                const sub = [
                  item.season,
                  item.team && item.team !== title ? item.team : null,
                  item.competition,
                  item.role,
                  item.period,
                  item.position,
                  item.jerseyNumber != null ? `#${item.jerseyNumber}` : null,
                  showLineStats && item.appearances != null ? `${item.appearances} ndeshje` : null,
                  showLineStats && item.goals != null ? `${item.goals} gola` : null,
                  showLineStats && item.assists != null ? `${item.assists} asiste` : null,
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <View
                    key={String(item.id || `${title}-${idx}`)}
                    style={[styles.listRow, { borderColor: theme.border, backgroundColor: theme.card }]}
                  >
                    <Text style={[styles.listTitle, { color: theme.text }]}>{title}</Text>
                    {sub ? <Text style={[styles.listMeta, { color: theme.muted }]}>{sub}</Text> : null}
                  </View>
                );
              })
            ) : careerText ? (
              <Text style={[styles.career, { color: theme.muted, borderColor: theme.border }]}>{careerText}</Text>
            ) : (
              <EmptyLine theme={theme}>Historia e klubeve dhe sezoneve do të shfaqet kur të plotësohet.</EmptyLine>
            )}
          </Section>

          <Section
            title="Ndeshjet e fundit"
            eyebrow="Historiku"
            theme={theme}
            action={
              matches.length && onOpenTab ? (
                <TouchableOpacity onPress={() => onOpenTab('matches')} hitSlop={8}>
                  <Text style={styles.linkAction}>Shiko të gjitha</Text>
                </TouchableOpacity>
              ) : null
            }
          >
            {matches.length ? (
              matches.slice(0, 8).map((match, index) => {
                const ga = [
                  hasValue(match.goals) ? `${match.goals} G` : null,
                  hasValue(match.assists) ? `${match.assists} A` : null,
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <View
                    key={String(match.id || index)}
                    style={[styles.listRow, { borderColor: theme.border, backgroundColor: theme.card }]}
                  >
                    <Text style={[styles.listTitle, { color: theme.text }]}>
                      {match.opponent || match.title || match.homeTeam || match.name || 'Ndeshje'}
                    </Text>
                    <Text style={[styles.listMeta, { color: theme.muted }]}>
                      {[
                        match.competition || match.tournament,
                        match.score || match.result,
                        match.date ? new Date(match.date).toLocaleDateString() : null,
                        ga || null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                );
              })
            ) : (
              <EmptyLine theme={theme}>Nuk ka ndeshje të regjistruara ende.</EmptyLine>
            )}
          </Section>

          <Section
            title="Highlights"
            eyebrow="Video dhe momente"
            theme={theme}
            action={
              (gallery.length > 0 || videos.length > 0) && onOpenTab ? (
                <TouchableOpacity onPress={() => onOpenTab(gallery.length ? 'gallery' : 'videos')} hitSlop={8}>
                  <Text style={styles.linkAction}>Hap galerinë</Text>
                </TouchableOpacity>
              ) : null
            }
          >
            {highlightVideos.length ? (
              <View style={styles.highlightRow}>
                {highlightVideos.slice(0, 3).map((video, index) => {
                  const posterRaw =
                    video.thumbnail ||
                    video.thumbnailUrl ||
                    (video.imageUrl && !isVideoItem({ imageUrl: video.imageUrl }) ? video.imageUrl : null);
                  const poster = mediaUri(posterRaw);
                  return (
                    <TouchableOpacity
                      key={String(video.id || index)}
                      style={[styles.highlightCard, { borderColor: theme.border, backgroundColor: theme.card }]}
                      onPress={() => onOpenTab?.('videos')}
                      activeOpacity={0.85}
                    >
                      {poster ? (
                        <OptimizedImage uri={poster} style={styles.highlightImg} width={400} contentFit="cover" />
                      ) : (
                        <View style={[styles.highlightImg, styles.highlightFallback]}>
                          <Text style={{ color: '#9A6B12', fontSize: 22 }}>▶</Text>
                        </View>
                      )}
                      <Text style={[styles.highlightTitle, { color: theme.text }]} numberOfLines={2}>
                        {video.title || video.matchContext || 'Highlight'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <EmptyLine theme={theme}>
                {gallery.length
                  ? 'Media e profilit është në galeri.'
                  : 'Videot dhe momentet e lojës do të shfaqen këtu.'}
              </EmptyLine>
            )}
          </Section>

          <Section
            title="Arritjet"
            eyebrow="Çmime dhe turne"
            theme={theme}
            action={
              achievements.length && onOpenTab ? (
                <TouchableOpacity onPress={() => onOpenTab('achievements')} hitSlop={8}>
                  <Text style={styles.linkAction}>Shiko</Text>
                </TouchableOpacity>
              ) : null
            }
          >
            {achievements.length ? (
              achievements.slice(0, 8).map((item, index) => (
                <View
                  key={String(item.id || index)}
                  style={[styles.listRow, styles.achieveRow, { borderColor: theme.border, backgroundColor: theme.card }]}
                >
                  <View style={styles.badgeGold}>
                    <Text style={styles.badgeGoldText}>{item.year || 'Arritje'}</Text>
                  </View>
                  <Text style={[styles.listTitle, { color: theme.text, flex: 1 }]}>
                    {item.title || item.name || item.description}
                  </Text>
                </View>
              ))
            ) : (
              <EmptyLine theme={theme}>Arritjet dhe çmimet do të shfaqen kur të shtohen.</EmptyLine>
            )}
          </Section>

          <Section
            title="Turnet"
            eyebrow="Pjesëmarrja"
            theme={theme}
            action={
              tournaments.length && onOpenTab ? (
                <TouchableOpacity onPress={() => onOpenTab('tournaments')} hitSlop={8}>
                  <Text style={styles.linkAction}>Shiko</Text>
                </TouchableOpacity>
              ) : null
            }
          >
            {tournaments.length ? (
              tournaments.slice(0, 6).map((item, index) => {
                const categoryLabel = item.tournamentCategory || item.category;
                const categoryText =
                  categoryLabel && String(categoryLabel).toLowerCase() !== 'open'
                    ? String(categoryLabel).toUpperCase()
                    : null;
                const name =
                  formatTournamentTitle(item) ||
                  item.name ||
                  item.tournamentName ||
                  item.title ||
                  'Turne';
                return (
                  <View
                    key={String(item.id || item.tournamentId || index)}
                    style={[styles.listRow, styles.achieveRow, { borderColor: theme.border, backgroundColor: theme.card }]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.listTitle, { color: theme.text }]}>
                        {name}
                        {categoryText ? (
                          <Text style={{ color: '#9A6B12', fontWeight: '700' }}> {categoryText}</Text>
                        ) : null}
                      </Text>
                      <Text style={[styles.listMeta, { color: theme.muted }]}>
                        {[
                          categoryText,
                          item.tournamentDescription || item.description,
                          item.season || item.tournamentSeason,
                          item.played != null ? `${item.played} ndeshje` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                    {hasValue(item.rank) ? (
                      <View style={styles.badgeGold}>
                        <Text style={styles.badgeGoldText}>#{item.rank}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })
            ) : (
              <EmptyLine theme={theme}>Nuk ka pjesëmarrje në turne për t'u shfaqur.</EmptyLine>
            )}
          </Section>
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
            {stats.founded || profile.founded ? (
              <Text style={[styles.line, { color: theme.muted }]}>
                <Text style={{ fontWeight: '700', color: theme.text }}>Founded: </Text>
                {profile.founded || stats.founded}
              </Text>
            ) : null}
            {stats.stadium || profile.stadium ? (
              <Text style={[styles.line, { color: theme.muted }]}>
                <Text style={{ fontWeight: '700', color: theme.text }}>Stadium: </Text>
                {profile.stadium || stats.stadium}
              </Text>
            ) : null}
            {stats.capacity != null || profile.capacity != null ? (
              <Text style={[styles.line, { color: theme.muted }]}>
                <Text style={{ fontWeight: '700', color: theme.text }}>Capacity: </Text>
                {String(profile.capacity ?? stats.capacity)}
              </Text>
            ) : null}
            {stats.league || profile.league ? (
              <Text style={[styles.line, { color: theme.muted }]}>
                <Text style={{ fontWeight: '700', color: theme.text }}>League: </Text>
                {profile.league || stats.league}
              </Text>
            ) : null}
          </Section>
          <Section
            title={`Skuadra · atletë (${(clubMembers || []).filter(isAthleteMembership).length})`}
            theme={theme}
          >
            <ClubSquadSection members={clubMembers} theme={theme} onPressUser={onPressUser} />
          </Section>
          <Section title={`Stafi / trajnerë (${clubStaff.length})`} theme={theme}>
            <StaffListSection staff={clubStaff} theme={theme} onPressUser={onPressUser} />
          </Section>
        </>
      ) : null}

      {(role === 'coach' || role === 'trajner') && (profile.coachCategory || profile.coachAffiliation || profile.club) ? (
        <Section title="Coach" theme={theme}>
          {profile.club ? (
            <TouchableOpacity
              disabled={!profile.clubId || !onPressUser}
              onPress={() => profile.clubId && onPressUser?.(profile.clubId)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.line,
                  { color: theme.muted },
                  profile.clubId ? { textDecorationLine: 'underline' } : null,
                ]}
              >
                <Text style={{ fontWeight: '700', color: theme.text }}>Club: </Text>
                {profile.club}
              </Text>
            </TouchableOpacity>
          ) : null}
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
            const clubUid = clubUser?.id || clubUser?.userId || a.clubId;
            const clubName =
              clubUser?.Profile?.club || `${clubUser?.firstName || ''} ${clubUser?.lastName || ''}`.trim() || 'Club';
            return (
              <TouchableOpacity
                key={String(a.id)}
                style={[styles.listRow, { borderColor: theme.border, backgroundColor: theme.card }]}
                disabled={clubUid == null || !onPressUser}
                onPress={() => clubUid != null && onPressUser?.(clubUid)}
                activeOpacity={0.75}
              >
                <Text style={[styles.listTitle, { color: theme.text }]}>{clubName}</Text>
                <Text style={[styles.listMeta, { color: theme.muted }]}>
                  {staffRoleLabel(a.staffRole || a.role)}
                  {a.teamType ? ` · ${teamTypeLabel(a.teamType)}` : ''}
                  {a.status ? ` · ${a.status}` : ''}
                </Text>
              </TouchableOpacity>
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

      {!isAthlete && careerItems?.length ? (
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
            const sub = [item.season, item.role, item.period, item.position].filter(Boolean).join(' · ');
            return (
              <View key={String(idx)} style={[styles.listRow, { borderColor: theme.border, backgroundColor: theme.card }]}>
                <Text style={[styles.listTitle, { color: theme.text }]}>{title}</Text>
                {sub ? <Text style={[styles.listMeta, { color: theme.muted }]}>{sub}</Text> : null}
              </View>
            );
          })}
        </Section>
      ) : null}

      {!isAthlete && careerText ? (
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
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 },
  linkAction: { fontSize: 13, fontWeight: '700', color: '#9A6B12' },
  bio: { fontSize: 15, lineHeight: 22 },
  identityGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  identityCell: {
    width: '50%',
    paddingHorizontal: 4,
    paddingBottom: 10,
    marginBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  identityLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  identityValue: { fontSize: 15, fontWeight: '600', marginTop: 4 },
  highlightRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  highlightCard: {
    width: '31%',
    minWidth: 96,
    flexGrow: 1,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  highlightImg: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#0f172a' },
  highlightFallback: { alignItems: 'center', justifyContent: 'center' },
  highlightTitle: { fontSize: 12, fontWeight: '600', padding: 8 },
  achieveRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badgeGold: {
    backgroundColor: 'rgba(154,107,18,0.18)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeGoldText: { color: '#9A6B12', fontWeight: '800', fontSize: 12 },
  emptyInline: {
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 12,
  },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  personMeta: { flex: 1, minWidth: 0 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 13, fontWeight: '800' },
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
