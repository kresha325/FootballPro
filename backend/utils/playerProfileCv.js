'use strict';

const { Op } = require('sequelize');
const { aggregatePlayerStats, blank } = require('./playerStatsEngine');
const { footballSeasonFromDate } = require('./footballSeason');
const { readStats } = require('./profileFields');

const AUTHORITATIVE_STAT_KEYS = [
  'goals',
  'assists',
  'matches',
  'appearances',
  'starts',
  'minutes',
  'yellowCards',
  'redCards',
  'shots',
  'shotsOnTarget',
  'passes',
  'keyPasses',
  'fouls',
  'saves',
  'cleanSheets',
  'cleanSheet',
  'rating',
  'ownGoals',
  'wins',
  'draws',
  'losses',
];

const UNSUPPORTED_STATS = [
  'tackles',
  'interceptions',
  'clearances',
  'blocks',
  'goalsConceded',
  'penaltiesSaved',
];

const FOOT_VALUES = new Set(['left', 'right', 'both']);

function positionGroup(position) {
  const value = String(position || '').toLowerCase();
  if (!value) return null;
  if (/goal|gk|portier|golman|goalkeeper/.test(value)) return 'goalkeeper';
  if (/defend|back|cb|lb|rb|wing-back|wingback|mbrojt/.test(value)) return 'defender';
  if (/mid|mesfush/.test(value)) return 'midfielder';
  if (/forward|striker|winger|attack|sulm/.test(value)) return 'forward';
  return null;
}

function positionSlice(group, totals) {
  if (!group || !totals) return null;
  const appearances = Number(totals.appearances) || 0;
  if (group === 'goalkeeper') {
    return {
      group,
      appearances,
      saves: Number(totals.saves) || 0,
      cleanSheets: Number(totals.cleanSheets) || 0,
    };
  }
  if (group === 'defender') {
    return {
      group,
      appearances,
      cleanSheets: Number(totals.cleanSheets) || 0,
      goals: Number(totals.goals) || 0,
      assists: Number(totals.assists) || 0,
    };
  }
  if (group === 'midfielder') {
    return {
      group,
      appearances,
      goals: Number(totals.goals) || 0,
      assists: Number(totals.assists) || 0,
      keyPasses: Number(totals.keyPasses) || 0,
    };
  }
  if (group === 'forward') {
    return {
      group,
      appearances,
      goals: Number(totals.goals) || 0,
      assists: Number(totals.assists) || 0,
      shots: Number(totals.shots) || 0,
      shotsOnTarget: Number(totals.shotsOnTarget) || 0,
    };
  }
  return null;
}

function stripAuthoritativeStats(stats) {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return {};
  const next = { ...stats };
  for (const key of AUTHORITATIVE_STAT_KEYS) delete next[key];
  return next;
}

function validateFootballStats(stats) {
  const next = stripAuthoritativeStats(stats);
  if (Object.prototype.hasOwnProperty.call(next, 'preferredFoot')) {
    if (next.preferredFoot != null && next.preferredFoot !== '') {
      const foot = String(next.preferredFoot).trim().toLowerCase();
      if (!FOOT_VALUES.has(foot)) {
        return { ok: false, field: 'preferredFoot', msg: 'Preferred foot must be left, right, or both.' };
      }
      next.preferredFoot = foot;
    } else {
      next.preferredFoot = null;
    }
  }

  if (next.height != null && next.height !== '') {
    const height = Number(next.height);
    if (!Number.isFinite(height) || height < 100 || height > 250) {
      return { ok: false, field: 'height', msg: 'Height must be between 100 and 250 cm.' };
    }
    next.height = Math.round(height);
  }

  if (next.weight != null && next.weight !== '') {
    const weight = Number(next.weight);
    if (!Number.isFinite(weight) || weight < 30 || weight > 200) {
      return { ok: false, field: 'weight', msg: 'Weight must be between 30 and 200 kg.' };
    }
    next.weight = Math.round(weight);
  }

  if (next.jerseyNumber != null && next.jerseyNumber !== '') {
    const jersey = Number(next.jerseyNumber);
    if (!Number.isInteger(jersey) || jersey < 1 || jersey > 99) {
      return { ok: false, field: 'jerseyNumber', msg: 'Jersey number must be between 1 and 99.' };
    }
    next.jerseyNumber = jersey;
  }

  if (next.secondaryPositions != null) {
    const list = Array.isArray(next.secondaryPositions)
      ? next.secondaryPositions
      : String(next.secondaryPositions)
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean);
    next.secondaryPositions = list
      .map((item) => String(item).trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 3);
  }

  if (next.youthSenior != null && next.youthSenior !== '') {
    const status = String(next.youthSenior).trim().toLowerCase();
    if (!['youth', 'senior'].includes(status)) {
      return { ok: false, field: 'youthSenior', msg: 'Youth/senior status must be youth or senior.' };
    }
    next.youthSenior = status;
  }

  for (const key of [
    'preferredLanguage',
    'playingLevel',
    'footballCategory',
    'currentTeam',
    'footballJourney',
    'strengths',
    'playingStyle',
    'objectives',
    'agentName',
    'agencyName',
    'nationality',
  ]) {
    if (next[key] == null) continue;
    const text = String(next[key]).trim();
    const max = ['footballJourney', 'strengths', 'playingStyle', 'objectives'].includes(key) ? 2000 : 120;
    next[key] = text ? text.slice(0, max) : null;
  }

  return { ok: true, stats: next };
}

function sanitizeAchievements(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
    .slice(0, 40)
    .map((item) => ({
      title: String(item.title || item.name || '').trim().slice(0, 120),
      season: item.season ? String(item.season).trim().slice(0, 32) : item.year ? String(item.year).slice(0, 32) : null,
      competition: item.competition ? String(item.competition).trim().slice(0, 120) : null,
      club: item.club ? String(item.club).trim().slice(0, 120) : null,
      description: item.description ? String(item.description).trim().slice(0, 500) : null,
      image: item.image || item.badge || null,
      icon: item.icon ? String(item.icon).slice(0, 8) : null,
      type: item.type ? String(item.type).trim().slice(0, 60) : null,
      year: item.year ? String(item.year).slice(0, 16) : null,
    }))
    .filter((item) => item.title);
}

function publicStatSummary(row) {
  if (!row) return null;
  return {
    appearances: Number(row.appearances) || 0,
    starts: Number(row.starts) || 0,
    minutes: Number(row.minutes) || 0,
    goals: Number(row.goals) || 0,
    assists: Number(row.assists) || 0,
    yellowCards: Number(row.yellowCards) || 0,
    redCards: Number(row.redCards) || 0,
    cleanSheets: Number(row.cleanSheets) || 0,
    saves: Number(row.saves) || 0,
    shots: Number(row.shots) || 0,
    shotsOnTarget: Number(row.shotsOnTarget) || 0,
    keyPasses: Number(row.keyPasses) || 0,
    passes: Number(row.passes) || 0,
    fouls: Number(row.fouls) || 0,
    ownGoals: Number(row.ownGoals) || 0,
    rating: row.rating == null ? null : row.rating,
    wins: Number(row.wins) || 0,
    draws: Number(row.draws) || 0,
    losses: Number(row.losses) || 0,
  };
}

function isFinishedMatch(match) {
  if (!match) return false;
  const status = String(match.status || '').toLowerCase();
  if (['scheduled', 'cancelled', 'postponed', 'live', 'in_progress'].includes(status)) return false;
  return match.scoreHome != null && match.scoreAway != null && match.scoreHome !== '' && match.scoreAway !== '';
}

function clubSideId(userId, stat, match) {
  if (!match) return null;
  const uid = Number(userId);
  if (Number(match.homeUserId) === uid) return uid;
  if (Number(match.awayUserId) === uid) return uid;
  const side = stat?.side || null;
  if (side === 'home') return Number(match.homeUserId) || null;
  if (side === 'away') return Number(match.awayUserId) || null;
  return null;
}

function resultFor(userId, stat, match) {
  if (!isFinishedMatch(match)) return null;
  const home = Number(match.scoreHome);
  const away = Number(match.scoreAway);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  const uid = Number(userId);
  let mine = null;
  let theirs = null;
  if (Number(match.homeUserId) === uid || stat?.side === 'home') {
    mine = home;
    theirs = away;
  } else if (Number(match.awayUserId) === uid || stat?.side === 'away') {
    mine = away;
    theirs = home;
  } else {
    return null;
  }
  if (mine > theirs) return 'win';
  if (mine < theirs) return 'loss';
  return 'draw';
}

function buildMatchLines({ userId, statRows = [], scorers = [], events = [], matches = [] }) {
  const uid = Number(userId);
  const matchById = {};
  for (const match of matches) matchById[Number(match.id)] = match;

  const ids = new Set();
  for (const row of statRows) {
    if (Number(row.userId) !== uid) continue;
    if (Number(row.minutes) > 0 || row.started) ids.add(Number(row.matchId));
  }
  for (const row of scorers) {
    if (Number(row.userId) === uid || Number(row.assistUserId) === uid) ids.add(Number(row.matchId));
  }
  for (const event of events) {
    if (Number(event.userId) !== uid) continue;
    if (['goal', 'penalty', 'assist', 'yellow_card', 'red_card', 'own_goal'].includes(event.type)) {
      ids.add(Number(event.matchId));
    }
  }

  const lines = [];
  for (const matchId of ids) {
    if (!Number.isFinite(matchId) || matchId <= 0) continue;
    const match = matchById[matchId] || { id: matchId };
    const stat = statRows.find((row) => Number(row.matchId) === matchId && Number(row.userId) === uid) || null;
    const scorer = scorers.find((row) => Number(row.matchId) === matchId && Number(row.userId) === uid) || null;
    const assistRows = scorers.filter((row) => Number(row.matchId) === matchId && Number(row.assistUserId) === uid);
    const goalEvents = events.filter(
      (event) =>
        Number(event.matchId) === matchId &&
        Number(event.userId) === uid &&
        (event.type === 'goal' || event.type === 'penalty')
    );
    const assistEvents = events.filter(
      (event) => Number(event.matchId) === matchId && Number(event.userId) === uid && event.type === 'assist'
    );

    let goals = 0;
    if (scorer) goals = Number(scorer.goals) || 0;
    else if (goalEvents.length) goals = goalEvents.length;
    else goals = Number(stat?.goals) || 0;

    let assists = 0;
    if (assistRows.length) assists = assistRows.length;
    else if (assistEvents.length) assists = assistEvents.length;
    else assists = Number(stat?.assists) || 0;

    const tournament = match.Tournament || null;
    lines.push({
      matchId,
      matchDate: match.matchDate || null,
      tournamentId: match.tournamentId || tournament?.id || null,
      competition: tournament?.name || null,
      season: tournament?.season || footballSeasonFromDate(match.matchDate),
      clubUserId: clubSideId(uid, stat, match),
      goals,
      assists,
      minutes: Number(stat?.minutes) || 0,
      rating: stat?.rating != null && stat.rating !== '' ? Number(stat.rating) : null,
      result: resultFor(uid, stat, match),
    });
  }

  lines.sort((a, b) => new Date(b.matchDate || 0).getTime() - new Date(a.matchDate || 0).getTime());
  return lines;
}

function subsetAggregate(userId, { statRows, scorers, events, matches }, matchIds) {
  const set = new Set((matchIds || []).map(Number));
  const rows = aggregatePlayerStats({
    scorers: scorers.filter((row) => set.has(Number(row.matchId))),
    events: events.filter((row) => set.has(Number(row.matchId))),
    statRows: statRows.filter((row) => set.has(Number(row.matchId))),
    matches: matches.filter((row) => set.has(Number(row.id))),
  });
  return rows.find((row) => Number(row.userId) === Number(userId)) || blank(userId);
}

function resultCounts(lines) {
  return lines.reduce(
    (acc, line) => {
      if (line.result === 'win') acc.wins += 1;
      else if (line.result === 'draw') acc.draws += 1;
      else if (line.result === 'loss') acc.losses += 1;
      return acc;
    },
    { wins: 0, draws: 0, losses: 0 }
  );
}

function withResults(summary, lines) {
  const results = resultCounts(lines);
  return { ...publicStatSummary(summary), ...results };
}

function buildPerformanceReport({ userId, position, statRows = [], scorers = [], events = [], matches = [], now = new Date() }) {
  const uid = Number(userId);
  const lines = buildMatchLines({ userId: uid, statRows, scorers, events, matches });
  const engine = aggregatePlayerStats({ scorers, events, statRows, matches });
  const mine = engine.find((row) => Number(row.userId) === uid) || blank(uid);
  const hasOfficial =
    lines.length > 0 ||
    Number(mine.appearances) > 0 ||
    Number(mine.goals) > 0 ||
    Number(mine.assists) > 0 ||
    Number(mine.minutes) > 0;

  const careerBase = publicStatSummary({
    ...mine,
    appearances: Math.max(Number(mine.appearances) || 0, lines.length),
  });
  const career = { ...careerBase, ...resultCounts(lines) };

  const currentSeason = footballSeasonFromDate(now);
  const seasonLines = lines.filter((line) => line.season && line.season === currentSeason);
  const season = withResults(
    subsetAggregate(uid, { statRows, scorers, events, matches }, seasonLines.map((line) => line.matchId)),
    seasonLines
  );
  season.appearances = Math.max(Number(season.appearances) || 0, seasonLines.length);

  const byCompetition = new Map();
  for (const line of lines) {
    const key = line.tournamentId || line.competition || 'unknown';
    if (!byCompetition.has(key)) {
      byCompetition.set(key, { id: line.tournamentId || null, name: line.competition || 'Competition', season: line.season || null, lines: [] });
    }
    byCompetition.get(key).lines.push(line);
  }
  const competitions = [...byCompetition.values()].map((group) => {
    const summary = withResults(
      subsetAggregate(uid, { statRows, scorers, events, matches }, group.lines.map((line) => line.matchId)),
      group.lines
    );
    summary.appearances = Math.max(Number(summary.appearances) || 0, group.lines.length);
    return {
      id: group.id,
      name: group.name,
      season: group.season,
      ...summary,
    };
  });

  const last5Lines = lines.slice(0, 5);
  const last10Lines = lines.slice(0, 10);
  const form = {
    last5: withResults(
      subsetAggregate(uid, { statRows, scorers, events, matches }, last5Lines.map((line) => line.matchId)),
      last5Lines
    ),
    last10: withResults(
      subsetAggregate(uid, { statRows, scorers, events, matches }, last10Lines.map((line) => line.matchId)),
      last10Lines
    ),
    season,
    career,
  };
  form.last5.appearances = last5Lines.length;
  form.last10.appearances = last10Lines.length;

  const group = positionGroup(position);
  return {
    hasOfficial,
    source: hasOfficial ? 'matches' : 'none',
    unsupported: UNSUPPORTED_STATS,
    career,
    season,
    competitions,
    positionGroup: group,
    positionStats: hasOfficial ? positionSlice(group, career) : null,
    form,
    trend: lines.slice(0, 10).map((line) => ({
      matchId: line.matchId,
      date: line.matchDate,
      competition: line.competition,
      goals: line.goals,
      assists: line.assists,
      minutes: line.minutes,
      rating: line.rating,
      result: line.result,
    })),
    lines,
  };
}

function teamLabel(teamType) {
  const labels = {
    first_team: 'First Team',
    youth: 'Youth',
    women: 'Women',
    men: 'Men',
    u23: 'U23',
    u21: 'U21',
    u19: 'U19',
    u17: 'U17',
    u15: 'U15',
    u13: 'U13',
    u11: 'U11',
    u9: 'U9',
  };
  return labels[teamType] || teamType || null;
}

function enrichCareerEntries(entries, { memberships = [], lines = [] } = {}) {
  if (!Array.isArray(entries)) return entries;
  return entries.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry;
    const clubUserId = Number(entry.clubUserId) || null;
    const clubName = String(entry.club || '').trim().toLowerCase();
    const membership =
      memberships.find((row) => clubUserId && Number(row.clubId) === clubUserId) ||
      memberships.find((row) => clubName && String(row.clubName || '').trim().toLowerCase() === clubName) ||
      null;
    const attributable = Boolean(clubUserId || membership);
    const start = membership?.joinedAt
      ? new Date(membership.joinedAt)
      : entry.fromYear
        ? new Date(Date.UTC(Number(entry.fromYear), 0, 1))
        : null;
    const end = membership?.leftAt ? new Date(membership.leftAt) : null;
    const related = attributable
      ? lines.filter((line) => {
          const lineClub = Number(line.clubUserId);
          const target = clubUserId || Number(membership?.clubId);
          if (!target || lineClub !== target) return false;
          const date = line.matchDate ? new Date(line.matchDate) : null;
          if (start && date && !Number.isNaN(date.getTime()) && date < start) return false;
          if (end && date && !Number.isNaN(date.getTime()) && date > end) return false;
          return true;
        })
      : [];
    return {
      ...entry,
      team: entry.team || teamLabel(membership?.teamType) || null,
      jerseyNumber: entry.jerseyNumber ?? membership?.jerseyNumber ?? null,
      position: entry.position || membership?.position || null,
      startDate: membership?.joinedAt || entry.startDate || (entry.fromYear ? `${entry.fromYear}-01-01` : null),
      endDate: membership?.leftAt || (entry.ongoing ? null : entry.endDate || null),
      competition: entry.competition || null,
      appearances: attributable ? related.length : null,
      goals: attributable ? related.reduce((sum, line) => sum + (Number(line.goals) || 0), 0) : null,
      assists: attributable ? related.reduce((sum, line) => sum + (Number(line.assists) || 0), 0) : null,
      statsSource: attributable ? 'matches' : null,
    };
  });
}

function mergeAchievements(manual, derived) {
  const base = sanitizeAchievements(manual);
  const extras = Array.isArray(derived) ? derived : [];
  const seen = new Set(base.map((item) => `${item.title}|${item.competition || ''}|${item.season || ''}`));
  for (const item of extras) {
    const key = `${item.title}|${item.competition || ''}|${item.season || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    base.push(item);
  }
  return base;
}

function buildCompleteness(profile, extras = {}) {
  const stats = readStats(profile);
  const user = extras.user || profile;
  const career = profile?.careerHistory;
  const hasCareer =
    (Array.isArray(career) && career.length > 0) ||
    (typeof career === 'string' && career.trim().length > 0) ||
    Boolean(profile?.clubJoinedYear);
  const official = extras.official;
  const hasStats = Boolean(
    official &&
      (Number(official.appearances) > 0 ||
        Number(official.goals) > 0 ||
        Number(official.assists) > 0 ||
        Number(official.minutes) > 0)
  );
  const sections = [
    {
      key: 'basic',
      label: 'Basic information',
      filled: Boolean(user?.firstName && user?.lastName && (profile?.profilePhoto || profile?.country || profile?.city)),
    },
    {
      key: 'football',
      label: 'Football information',
      filled: Boolean(profile?.position && (stats.preferredFoot || (Array.isArray(stats.secondaryPositions) && stats.secondaryPositions.length))),
    },
    {
      key: 'physical',
      label: 'Physical information',
      filled: Boolean(stats.height && stats.weight),
    },
    { key: 'club', label: 'Club', filled: Boolean(profile?.club) },
    { key: 'career', label: 'Career', filled: hasCareer },
    { key: 'statistics', label: 'Statistics', filled: hasStats },
    {
      key: 'media',
      label: 'Media',
      filled: Boolean((extras.galleryCount || 0) > 0 || (extras.mediaCount || 0) > 0 || profile?.coverPhoto),
    },
    { key: 'bio', label: 'Bio', filled: Boolean(String(profile?.bio || '').trim()) },
    {
      key: 'achievements',
      label: 'Achievements',
      filled: Boolean(Array.isArray(profile?.achievements) && profile.achievements.length > 0),
    },
  ];
  const filled = sections.filter((section) => section.filled).length;
  const total = sections.length;
  return {
    filled,
    total,
    percent: total ? Math.round((filled / total) * 100) : 0,
    sections,
  };
}

function overlayOfficialStats(stats, performance) {
  const next = stats && typeof stats === 'object' && !Array.isArray(stats) ? { ...stats } : {};
  if (!performance?.hasOfficial) {
    for (const key of AUTHORITATIVE_STAT_KEYS) delete next[key];
    return next;
  }
  const career = performance.career || {};
  next.appearances = career.appearances;
  next.matches = career.appearances;
  next.starts = career.starts;
  next.minutes = career.minutes;
  next.goals = career.goals;
  next.assists = career.assists;
  next.yellowCards = career.yellowCards;
  next.redCards = career.redCards;
  next.shots = career.shots;
  next.shotsOnTarget = career.shotsOnTarget;
  next.keyPasses = career.keyPasses;
  next.saves = career.saves;
  next.cleanSheets = career.cleanSheets;
  next.rating = career.rating;
  next.wins = career.wins;
  next.draws = career.draws;
  next.losses = career.losses;
  return next;
}

async function loadBundle(userIds) {
  const ids = [...new Set((userIds || []).map(Number).filter((id) => Number.isFinite(id) && id > 0))];
  if (!ids.length) return { statRows: [], scorers: [], events: [], matches: [] };
  const PlayerMatchStat = require('../models/PlayerMatchStat');
  const MatchScorer = require('../models/MatchScorer');
  const MatchEvent = require('../models/MatchEvent');
  const Match = require('../models/Match');
  const { Tournament } = require('../models/Tournament');

  const [statRows, scorers, events] = await Promise.all([
    PlayerMatchStat.findAll({ where: { userId: { [Op.in]: ids } }, raw: true }),
    MatchScorer.findAll({
      where: { [Op.or]: [{ userId: { [Op.in]: ids } }, { assistUserId: { [Op.in]: ids } }] },
      raw: true,
    }),
    MatchEvent.findAll({ where: { userId: { [Op.in]: ids } }, raw: true }),
  ]);

  const matchIds = new Set();
  for (const row of [...statRows, ...scorers, ...events]) {
    if (row.matchId != null) matchIds.add(Number(row.matchId));
  }
  let matches = [];
  const idList = [...matchIds].filter((id) => id > 0);
  if (idList.length) {
    matches = await Match.findAll({
      where: { id: { [Op.in]: idList } },
      include: [{ model: Tournament, attributes: ['id', 'name', 'season', 'status', 'lifecycle'], required: false }],
    });
    matches = matches.map((match) => (match.get ? match.get({ plain: true }) : match));
  }
  return { statRows, scorers, events, matches };
}

async function loadOfficialPerformance(userId, position) {
  const bundle = await loadBundle([userId]);
  return buildPerformanceReport({ userId, position, ...bundle });
}

async function loadOfficialTotalsForUsers(userIds) {
  const bundle = await loadBundle(userIds);
  const map = {};
  for (const userId of userIds) {
    const report = buildPerformanceReport({ userId, position: null, ...bundle });
    map[Number(userId)] = report.hasOfficial
      ? report.career
      : { appearances: 0, goals: 0, assists: 0, minutes: 0, rating: null, wins: 0, draws: 0, losses: 0 };
  }
  return map;
}

async function loadMemberships(userId) {
  const ClubMember = require('../models/ClubMember');
  const User = require('../models/User');
  const rows = await ClubMember.findAll({
    where: { athleteId: userId, status: 'approved' },
    include: [{ model: User, as: 'club', attributes: ['id', 'firstName', 'lastName'], required: false }],
  });
  return rows.map((row) => {
    const plain = row.get({ plain: true });
    const clubName = [plain.club?.firstName, plain.club?.lastName].filter(Boolean).join(' ').trim();
    return {
      clubId: plain.clubId,
      clubName,
      teamType: plain.teamType,
      position: plain.position,
      jerseyNumber: plain.jerseyNumber,
      joinedAt: plain.joinedAt,
      leftAt: plain.leftAt,
    };
  });
}

async function loadDerivedAchievements(userId) {
  const TournamentSquadMember = require('../models/TournamentSquadMember');
  const { Tournament, TournamentParticipant } = require('../models/Tournament');
  const squads = await TournamentSquadMember.findAll({
    where: { athleteUserId: userId },
    attributes: ['tournamentId', 'clubUserId'],
    raw: true,
  });
  const clubIds = [...new Set(squads.map((row) => Number(row.clubUserId)).filter((id) => id > 0))];
  const participantIds = [Number(userId), ...clubIds];
  const own = await TournamentParticipant.findAll({
    where: { userId: { [Op.in]: participantIds }, status: 'accepted' },
    attributes: ['tournamentId', 'userId'],
    raw: true,
  });
  const tournamentIds = [...new Set(own.map((row) => Number(row.tournamentId)).filter((id) => id > 0))];
  if (!tournamentIds.length) return [];

  const participants = await TournamentParticipant.findAll({
    where: { tournamentId: { [Op.in]: tournamentIds }, status: 'accepted' },
    include: [{ model: Tournament, attributes: ['id', 'name', 'season', 'status', 'lifecycle'], required: true }],
  });
  const grouped = new Map();
  for (const row of participants) {
    const plain = row.get({ plain: true });
    const tournament = plain.Tournament;
    const done =
      ['completed', 'finished'].includes(String(tournament?.status || '').toLowerCase()) ||
      String(tournament?.lifecycle || '').toLowerCase() === 'completed';
    if (!done) continue;
    if (!grouped.has(plain.tournamentId)) grouped.set(plain.tournamentId, []);
    grouped.get(plain.tournamentId).push(plain);
  }

  const achievements = [];
  for (const [tournamentId, list] of grouped) {
    const max = Math.max(...list.map((row) => Number(row.points) || 0));
    if (max <= 0) continue;
    const winners = list.filter((row) => (Number(row.points) || 0) === max);
    const squad = squads.find((row) => Number(row.tournamentId) === Number(tournamentId));
    const won = winners.some(
      (row) => Number(row.userId) === Number(userId) || (squad && Number(row.userId) === Number(squad.clubUserId))
    );
    if (!won) continue;
    const tournament = list[0].Tournament;
    achievements.push({
      title: 'Championship',
      season: tournament?.season || null,
      competition: tournament?.name || null,
      club: null,
      description: null,
      image: null,
      source: 'tournament',
      tournamentId: Number(tournamentId),
    });
  }
  return achievements;
}

async function resolveVerificationStatus(user) {
  if (!user) return 'UNVERIFIED';
  const { effectiveVerified, needsParentVerification } = require('./userVerification');
  if (effectiveVerified(user)) return 'VERIFIED';

  let parentPending = false;
  try {
    const User = require('../models/User');
    const full = await User.findByPk(user.id, {
      attributes: ['id', 'role', 'dateOfBirth', 'parentVerified', 'parentVerificationToken'],
    });
    parentPending = Boolean(full?.parentVerificationToken) && needsParentVerification(full || user) && !full?.parentVerified;
  } catch (err) {
    console.warn('verification parent check:', err?.message || err);
  }

  try {
    const ClubMember = require('../models/ClubMember');
    const pending = await ClubMember.count({ where: { athleteId: user.id, status: 'pending' } });
    let rosterPending = 0;
    try {
      const ClubRosterRequest = require('../models/ClubRosterRequest');
      rosterPending = await ClubRosterRequest.count({ where: { athleteId: user.id, status: 'pending' } });
    } catch (_err) {
      rosterPending = 0;
    }
    if (parentPending || pending > 0 || rosterPending > 0) return 'PENDING';
    const approved = await ClubMember.count({ where: { athleteId: user.id, status: 'approved' } });
    const rejected = await ClubMember.count({ where: { athleteId: user.id, status: 'rejected' } });
    if (rejected > 0 && approved === 0) return 'REJECTED';
  } catch (err) {
    console.warn('verification club check:', err?.message || err);
    if (parentPending) return 'PENDING';
  }
  return 'UNVERIFIED';
}

async function viewerAccess(req, profileUserId) {
  const viewer = req?.user || null;
  const isOwner = Boolean(viewer && Number(viewer.id) === Number(profileUserId));
  const { isProfessionalRole } = require('./profilePrivacy');
  const isProfessional = Boolean(viewer && isProfessionalRole(viewer.role));
  let isFollower = false;
  if (viewer && !isOwner) {
    try {
      const Follow = require('../models/Follow');
      const row = await Follow.findOne({
        where: { followerId: viewer.id, followingId: profileUserId, status: 'accepted' },
        attributes: ['id'],
      });
      isFollower = Boolean(row);
    } catch (err) {
      console.warn('viewer follow check:', err?.message || err);
    }
  }
  return { isOwner, isFollower, isProfessional, viewer };
}

async function finalizeProfileResponse(req, response, user) {
  if (!response || !user) return response;
  const { applyProfilePrivacy, normalizePrivacy } = require('./profilePrivacy');
  const access = await viewerAccess(req, user.id);
  const role = String(user.role || response.role || '').toLowerCase();

  if (role === 'athlete') {
    let performance = buildPerformanceReport({ userId: user.id, position: response.position });
    try {
      performance = await loadOfficialPerformance(user.id, response.position);
    } catch (err) {
      console.warn('official performance:', err?.message || err);
    }
    response.performance = {
      hasOfficial: performance.hasOfficial,
      source: performance.source,
      unsupported: performance.unsupported,
      career: performance.career,
      season: performance.season,
      competitions: performance.competitions,
      positionGroup: performance.positionGroup,
      positionStats: performance.positionStats,
      form: performance.form,
      trend: performance.trend,
    };
    response.statisticsSource = performance.source;
    response.stats = overlayOfficialStats(response.stats, performance);

    try {
      const memberships = await loadMemberships(user.id);
      if (Array.isArray(response.careerHistory)) {
        response.careerHistory = enrichCareerEntries(response.careerHistory, {
          memberships,
          lines: performance.lines || [],
        });
      }
      const current = memberships.find((row) => !row.leftAt) || memberships[0];
      if (current && !response.stats.currentTeam) {
        response.stats.currentTeam = teamLabel(current.teamType);
      }
      if (current?.jerseyNumber && response.stats.jerseyNumber == null) {
        response.stats.jerseyNumber = current.jerseyNumber;
      }
    } catch (err) {
      console.warn('career enrichment:', err?.message || err);
    }

    try {
      const derived = await loadDerivedAchievements(user.id);
      response.achievements = mergeAchievements(response.achievements, derived);
    } catch (err) {
      console.warn('derived achievements:', err?.message || err);
      response.achievements = sanitizeAchievements(response.achievements);
    }

    try {
      response.verificationStatus = await resolveVerificationStatus(user);
    } catch (err) {
      console.warn('verification status:', err?.message || err);
      response.verificationStatus = user.verified ? 'VERIFIED' : 'UNVERIFIED';
    }

    let galleryCount = Number(response.galleryCount) || 0;
    if (!galleryCount) {
      try {
        const Gallery = require('../models/Gallery');
        galleryCount = await Gallery.count({ where: { userId: user.id } });
      } catch (_err) {
        galleryCount = 0;
      }
    }
    let mediaCount = 0;
    try {
      const MediaItem = require('../models/MediaItem');
      mediaCount = await MediaItem.count({ where: { playerId: user.id } });
    } catch (_err) {
      mediaCount = 0;
    }
    response.completeness = buildCompleteness(response, {
      user,
      official: performance.hasOfficial ? performance.career : null,
      galleryCount,
      mediaCount,
    });

    if (access.isOwner || access.isProfessional) {
      response.scouting = {
        position: response.position || null,
        age: response.age ?? null,
        club: response.club || null,
        completeness: response.completeness,
        recentForm: response.performance?.form?.last5 || null,
        statistics: response.performance?.career || null,
        verificationStatus: response.verificationStatus,
      };
    } else {
      delete response.scouting;
    }
  } else {
    response.completeness = buildCompleteness(response, { user, official: null, galleryCount: response.galleryCount || 0 });
  }

  response.privacy = normalizePrivacy(response.privacy);
  applyProfilePrivacy(response, access, response.privacy);

  if (!access.isOwner) {
    try {
      const { recordProfileView } = require('./profileViews');
      await recordProfileView({ viewerId: access.viewer?.id, profileUserId: user.id });
    } catch (err) {
      console.warn('profile view:', err?.message || err);
    }
  }

  return response;
}

module.exports = {
  AUTHORITATIVE_STAT_KEYS,
  UNSUPPORTED_STATS,
  positionGroup,
  positionSlice,
  stripAuthoritativeStats,
  validateFootballStats,
  sanitizeAchievements,
  buildMatchLines,
  buildPerformanceReport,
  enrichCareerEntries,
  mergeAchievements,
  buildCompleteness,
  overlayOfficialStats,
  loadBundle,
  loadOfficialPerformance,
  loadOfficialTotalsForUsers,
  resolveVerificationStatus,
  viewerAccess,
  finalizeProfileResponse,
  teamLabel,
};
