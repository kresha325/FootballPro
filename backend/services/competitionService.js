/**
 * Persistence for the competition engine. Controllers stay thin; this is the
 * only place that generates fixtures, records official results, and advances rounds.
 */

const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { Tournament, TournamentParticipant } = require('../models/Tournament');
const Match = require('../models/Match');
const Bracket = require('../models/Bracket');
const MatchScorer = require('../models/MatchScorer');
const MatchEvent = require('../models/MatchEvent');
const PlayerMatchStat = require('../models/PlayerMatchStat');
const TournamentSquadMember = require('../models/TournamentSquadMember');
const User = require('../models/User');
const Profile = require('../models/Profile');
const { saveMatchGoalEvents, syncProfileGoalAssistStats } = require('../utils/matchGoalEvents');
const { canFillMatchStats, canManageTournamentMatches } = require('../utils/matchPermissions');
const { demoteAthleteParticipantsOnClubTournament } = require('../utils/tournamentSquad');
const { notifyTournament } = require('../controllers/notifications');
const {
  resolveLifecycle,
  legacyStatusFor,
  canTransition,
  assertResultMutation,
  assertCanStart,
  slugifyCompetitionName,
} = require('../utils/competitionLifecycle');
const {
  planCompetitionFixtures,
  findDuplicateFixtures,
  fixtureIdentity,
  planGroupQualification,
  scheduleFixtureDates,
} = require('../utils/fixtureGenerator');
const { standingsFromMatches, groupStandings } = require('../utils/standingsEngine');
const {
  validateOfficialResult,
  validateMatchEvent,
  winnerOfStoredMatch,
  planKnockoutAdvancement,
} = require('../utils/matchResult');
const { aggregatePlayerStats } = require('../utils/playerStatsEngine');

function fail(status, msg) {
  const err = new Error(msg);
  err.status = status;
  return err;
}

async function assertPlayerOnSide(match, userId, side) {
  const id = Number(userId);
  if (!Number.isFinite(id)) throw fail(400, 'A player is required.');
  const teamUserId = side === 'away' ? Number(match.awayUserId) : Number(match.homeUserId);
  if (!teamUserId) throw fail(400, 'That side has no team.');
  if (id === teamUserId) return;
  const squad = await TournamentSquadMember.findOne({
    where: { tournamentId: match.tournamentId, athleteUserId: id, clubUserId: teamUserId },
  });
  if (!squad) throw fail(400, 'Player is not on this team for the competition.');
}

function plain(row) {
  return row && typeof row.get === 'function' ? row.get({ plain: true }) : row;
}

async function loadTournament(idOrSlug) {
  const key = String(idOrSlug ?? '');
  if (!key) return null;
  if (/^\d+$/.test(key)) return Tournament.findByPk(key);
  return Tournament.findOne({ where: { slug: key } });
}

function acceptedParticipants(rows) {
  return (rows || []).filter((row) => (row.status || 'accepted') === 'accepted');
}

async function recomputeTournamentStandings(tournamentId, transaction) {
  const participants = await TournamentParticipant.findAll({ where: { tournamentId }, transaction });
  if (!participants.length) return [];
  const matches = await Match.findAll({
    where: { tournamentId },
    transaction,
  });
  const computed = standingsFromMatches(
    participants.map((p) => p.userId),
    matches.map(plain),
    { headToHead: true }
  );
  const byUser = Object.fromEntries(computed.map((row) => [Number(row.userId), row]));
  for (const participant of participants) {
    const stats = byUser[Number(participant.userId)] || {
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    };
    participant.wins = stats.wins || 0;
    participant.draws = stats.draws || 0;
    participant.losses = stats.losses || 0;
    participant.goalsFor = stats.goalsFor || 0;
    participant.goalsAgainst = stats.goalsAgainst || 0;
    participant.points = stats.points || 0;
    await participant.save({ transaction });
  }
  return computed;
}

async function createPlannedMatches(tournament, fixtures, transaction) {
  const rows = [];
  for (let i = 0; i < fixtures.length; i += 1) {
    const fixture = fixtures[i];
    const walkover = !!fixture.walkover || fixture.awayUserId == null;
    const match = await Match.create(
      {
        tournamentId: tournament.id,
        homeUserId: fixture.homeUserId,
        awayUserId: walkover ? null : fixture.awayUserId,
        status: walkover ? 'walkover' : 'scheduled',
        round: fixture.round || 1,
        roundLabel: fixture.roundLabel || null,
        groupName: fixture.groupName || null,
        stage: fixture.stage || null,
        matchDate: fixture.matchDate || tournament.startDate || new Date(),
        scoreHome: walkover ? null : null,
        scoreAway: walkover ? null : null,
        winnerUserId: walkover ? fixture.homeUserId : null,
        decidedBy: walkover ? 'walkover' : null,
        publicSlug: `match-${tournament.id}-${fixture.stage || 'fixture'}-${fixture.round || 1}-${i + 1}`,
      },
      { transaction }
    );
    rows.push(match);
    if ((fixture.stage || tournament.type) === 'knockout' || tournament.type === 'cup' || tournament.type === 'tournament') {
      if (fixture.stage === 'knockout' || tournament.type !== 'group_knockout') {
        await Bracket.create(
          {
            tournamentId: tournament.id,
            round: match.round || 1,
            position: i,
            matchId: match.id,
          },
          { transaction }
        );
      }
    }
  }
  return rows;
}

async function startCompetition({ tournamentId, user, options = {} }) {
  const tournament = await loadTournament(tournamentId);
  if (!tournament) throw fail(404, 'Tournament not found');
  const authz = canManageTournamentMatches(tournament, user);
  if (!authz.ok) throw fail(authz.status, authz.msg);

  const participants = await TournamentParticipant.findAll({
    where: { tournamentId: tournament.id },
    include: [{ model: User, attributes: ['id', 'role'] }],
  });
  const participantType = tournament.participantType || 'individual';
  const standing = participantType === 'club'
    ? participants.filter((p) => String(p.User?.role || '').toLowerCase() === 'club')
    : participants;
  const accepted = acceptedParticipants(standing);
  const gate = assertCanStart(tournament, accepted.length);
  if (!gate.ok) throw fail(gate.status, gate.msg);

  const existing = await Match.count({ where: { tournamentId: tournament.id } });
  if (existing > 0) throw fail(409, 'Fixtures already exist for this competition.');

  const seeded = [...accepted].sort((a, b) => {
    const sa = a.seed == null ? 9999 : Number(a.seed);
    const sb = b.seed == null ? 9999 : Number(b.seed);
    if (sa !== sb) return sa - sb;
    return Number(a.userId) - Number(b.userId);
  });

  const doubleRound = options.homeAndAway != null ? !!options.homeAndAway : !!tournament.homeAndAway;
  const groupCount = options.groupsCount || tournament.groupsCount || undefined;
  const plan = planCompetitionFixtures(
    seeded.map((p) => p.userId),
    {
      type: tournament.type,
      doubleRound,
      groupCount,
      startDate: options.startDate || tournament.startDate,
      endDate: options.endDate || tournament.endDate,
    }
  );
  if (!plan.ok) throw fail(400, plan.msg);

  const created = await sequelize.transaction(async (transaction) => {
    if (plan.groups?.length) {
      const groupByUser = {};
      plan.groups.forEach((group) => {
        group.teamIds.forEach((id) => {
          groupByUser[Number(id)] = group.name;
        });
      });
      for (const participant of seeded) {
        if (groupByUser[Number(participant.userId)]) {
          participant.groupName = groupByUser[Number(participant.userId)];
          await participant.save({ transaction });
        }
      }
      tournament.groupsCount = plan.groups.length;
    }
    tournament.homeAndAway = doubleRound;
    const matches = await createPlannedMatches(tournament, plan.fixtures, transaction);
    tournament.lifecycle = 'active';
    tournament.status = legacyStatusFor('active');
    if (!tournament.slug) tournament.slug = slugifyCompetitionName(tournament.name, tournament.id);
    await tournament.save({ transaction });
    return matches;
  });

  for (const participant of accepted) {
    try {
      await notifyTournament(
        participant.userId,
        tournament.id,
        'Tournament Started!',
        `${tournament.name} has started! Check your match schedule.`
      );
    } catch (_err) {
      /* notification failure must not roll back fixtures */
    }
  }

  return {
    msg: 'Tournament started successfully',
    tournament,
    matchesCreated: created.length,
    matches: created,
  };
}

async function maybeAdvance(tournament, transaction) {
  const matches = await Match.findAll({ where: { tournamentId: tournament.id }, transaction });
  const plainMatches = matches.map(plain);
  const type = tournament.type;

  if (type === 'group_knockout') {
    const groupMatches = plainMatches.filter((m) => m.stage === 'group' || m.groupName);
    const knockoutExists = plainMatches.some((m) => m.stage === 'knockout');
    const groupsDone = groupMatches.length > 0 && groupMatches.every((m) => m.status === 'finished' || m.status === 'walkover');
    if (groupsDone && !knockoutExists) {
      const participants = await TournamentParticipant.findAll({
        where: { tournamentId: tournament.id, status: 'accepted' },
        transaction,
      });
      const byGroup = {};
      for (const participant of participants) {
        if (!participant.groupName) continue;
        if (!byGroup[participant.groupName]) byGroup[participant.groupName] = [];
        byGroup[participant.groupName].push(participant.userId);
      }
      const tables = groupStandings(byGroup, groupMatches, { headToHead: true });
      const qualified = planGroupQualification(tables, tournament.qualifyPerGroup || 2);
      if (!qualified.ok) return { advanced: false, reason: qualified.msg };
      const dated = scheduleFixtureDates(qualified.fixtures, {
        startDate: new Date(),
        endDate: tournament.endDate,
      });
      const fixtures = dated.ok ? dated.fixtures : qualified.fixtures.map((f) => ({ ...f, matchDate: new Date() }));
      const duplicates = findDuplicateFixtures(fixtures);
      if (duplicates.length) throw fail(409, 'Knockout bracket would duplicate a fixture.');
      await createPlannedMatches(tournament, fixtures, transaction);
      return { advanced: true, kind: 'group_knockout' };
    }
  }

  if (type === 'knockout' || type === 'cup' || type === 'tournament' || type === 'group_knockout') {
    const knockout = plainMatches.filter((m) => {
      if (type === 'group_knockout') return m.stage === 'knockout';
      return true;
    });
    if (!knockout.length) return { advanced: false };
    const maxRound = Math.max(...knockout.map((m) => Number(m.round) || 1));
    const current = knockout.filter((m) => Number(m.round) === maxRound);
    const nextExists = knockout.some((m) => Number(m.round) === maxRound + 1);
    if (nextExists) return { advanced: false };
    const plan = planKnockoutAdvancement(current);
    if (!plan.ok) return { advanced: false, reason: plan.reason };
    if (plan.championUserId) {
      tournament.lifecycle = 'completed';
      tournament.status = legacyStatusFor('completed');
      await tournament.save({ transaction });
      return { advanced: true, championUserId: plan.championUserId };
    }
    const dated = scheduleFixtureDates(plan.fixtures, {
      startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      endDate: tournament.endDate,
    });
    const fixtures = dated.ok ? dated.fixtures : plan.fixtures;
    await createPlannedMatches(tournament, fixtures, transaction);
    return { advanced: true, kind: 'knockout' };
  }

  const allDone = plainMatches.length > 0 && plainMatches.every((m) => ['finished', 'walkover', 'cancelled'].includes(m.status));
  if (allDone && (type === 'league' || type === 'group_knockout')) {
    const stillGroup = type === 'group_knockout' && plainMatches.some((m) => m.stage === 'knockout' && !['finished', 'walkover'].includes(m.status));
    if (!stillGroup) {
      tournament.lifecycle = 'completed';
      tournament.status = legacyStatusFor('completed');
      await tournament.save({ transaction });
      return { advanced: true, completed: true };
    }
  }
  return { advanced: false };
}

async function recordOfficialResult({ matchId, user, payload = {} }) {
  const match = await Match.findByPk(matchId, { include: [{ model: Tournament }] });
  if (!match) throw fail(404, 'Match not found');
  const tournament = match.Tournament;
  if (!tournament) throw fail(400, 'Match not part of a tournament');
  const authz = canFillMatchStats(tournament, user, match);
  if (!authz.ok) throw fail(authz.status, authz.msg);
  const gate = assertResultMutation(tournament);
  if (!gate.ok) throw fail(gate.status, gate.msg);
  if (match.status === 'finished' && resolveLifecycle(tournament) === 'completed') {
    throw fail(409, 'Completed competition is locked. Results cannot be changed.');
  }

  const validated = validateOfficialResult({
    ...payload,
    competitionType: tournament.type,
    stage: match.stage,
    groupName: match.groupName,
    homeUserId: match.homeUserId,
    awayUserId: match.awayUserId,
  });
  if (!validated.ok) throw fail(validated.status, validated.msg);

  const goalEvents = payload.goalEvents || payload.scorers;
  if (Array.isArray(goalEvents)) {
    for (const event of goalEvents) {
      if (!event?.userId) continue;
      await assertPlayerOnSide(match, event.userId, event.side || (Number(event.userId) === Number(match.homeUserId) ? 'home' : 'away'));
      if (event.assistUserId) {
        await assertPlayerOnSide(match, event.assistUserId, event.side || 'home');
      }
    }
  }

  return sequelize.transaction(async (transaction) => {
    await match.update(
      {
        ...validated.patch,
        refereeName: payload.refereeName !== undefined ? payload.refereeName : match.refereeName,
        refereeUserId: payload.refereeUserId !== undefined ? payload.refereeUserId : match.refereeUserId,
        venue: payload.venue !== undefined ? payload.venue : match.venue,
        highlightsUrl: payload.highlightsUrl !== undefined ? payload.highlightsUrl : match.highlightsUrl,
        clockPhase: 'FT',
      },
      { transaction }
    );

    if (Array.isArray(goalEvents)) {
      await saveMatchGoalEvents(match.id, goalEvents, match, { transaction });
    }

    if (resolveLifecycle(tournament) === 'active') {
      tournament.lifecycle = 'in_progress';
      tournament.status = legacyStatusFor('in_progress');
      await tournament.save({ transaction });
    }

    await recomputeTournamentStandings(tournament.id, transaction);
    const advancement = await maybeAdvance(tournament, transaction);
    return { match, tournament, advancement, goalEvents };
  }).then(async (result) => {
    if (Array.isArray(result.goalEvents)) {
      const ids = [];
      for (const event of result.goalEvents) {
        if (event?.userId) ids.push(event.userId);
        if (event?.assistUserId) ids.push(event.assistUserId);
      }
      try {
        await syncProfileGoalAssistStats(ids);
      } catch (syncErr) {
        console.error('syncProfileGoalAssistStats:', syncErr);
      }
    }
    return result;
  });
}

async function updateLiveMatch({ matchId, user, payload = {} }) {
  const match = await Match.findByPk(matchId, { include: [{ model: Tournament }] });
  if (!match) throw fail(404, 'Match not found');
  const tournament = match.Tournament;
  const authz = canFillMatchStats(tournament, user, match);
  if (!authz.ok) throw fail(authz.status, authz.msg);
  const gate = assertResultMutation(tournament);
  if (!gate.ok) throw fail(gate.status, gate.msg);
  if (payload.status === 'finished') {
    return recordOfficialResult({ matchId, user, payload });
  }
  const home = payload.scoreHome == null || payload.scoreHome === '' ? match.scoreHome : Number(payload.scoreHome);
  const away = payload.scoreAway == null || payload.scoreAway === '' ? match.scoreAway : Number(payload.scoreAway);
  if (home != null && (!Number.isInteger(home) || home < 0)) throw fail(400, 'Home score must be a non-negative integer.');
  if (away != null && (!Number.isInteger(away) || away < 0)) throw fail(400, 'Away score must be a non-negative integer.');
  await match.update({
    scoreHome: home,
    scoreAway: away,
    status: payload.status || 'ongoing',
    clockMinute: payload.clockMinute != null ? Number(payload.clockMinute) : match.clockMinute,
    clockPhase: payload.clockPhase || match.clockPhase || '1H',
  });
  if (resolveLifecycle(tournament) === 'active') {
    tournament.lifecycle = 'in_progress';
    tournament.status = legacyStatusFor('in_progress');
    await tournament.save();
  }
  return { match, tournament };
}

function dateWindowError(tournament, matchDate) {
  if (!matchDate) return 'Match date is required.';
  const when = new Date(matchDate);
  if (Number.isNaN(when.getTime())) return 'Match date is invalid.';
  if (tournament.startDate && when < new Date(tournament.startDate)) {
    return 'Match date is before the competition starts.';
  }
  if (tournament.endDate && when > new Date(tournament.endDate)) {
    return 'Match date is after the competition ends.';
  }
  if (tournament.startDate && tournament.endDate && new Date(tournament.endDate) < new Date(tournament.startDate)) {
    return 'End date is before start date.';
  }
  return null;
}

async function assertManualFixture({ tournament, homeUserId, awayUserId, round, groupName, matchDate, excludeMatchId }) {
  if (!homeUserId || !awayUserId) throw fail(400, 'Both teams are required.');
  if (Number(homeUserId) === Number(awayUserId)) throw fail(400, 'A team cannot play itself.');
  if (isTerminalTournament(tournament)) throw fail(409, 'Competition is closed.');
  const dateError = dateWindowError(tournament, matchDate);
  if (dateError) throw fail(400, dateError);

  const participants = await TournamentParticipant.findAll({
    where: {
      tournamentId: tournament.id,
      userId: { [Op.in]: [homeUserId, awayUserId] },
      status: 'accepted',
    },
  });
  if (participants.length < 2) throw fail(400, 'Both teams must be accepted participants.');

  const existing = await Match.findAll({ where: { tournamentId: tournament.id } });
  const candidate = {
    homeUserId: Number(homeUserId),
    awayUserId: Number(awayUserId),
    round: round || 1,
    groupName: groupName || null,
    stage: groupName ? 'group' : tournament.type === 'league' ? 'league' : 'knockout',
  };
  const identity = fixtureIdentity(candidate, { doubleRound: !!tournament.homeAndAway });
  const clash = existing.find((row) => {
    if (excludeMatchId && Number(row.id) === Number(excludeMatchId)) return false;
    return fixtureIdentity(plain(row), { doubleRound: !!tournament.homeAndAway }) === identity;
  });
  if (clash) throw fail(409, 'Duplicate fixture.');
}

function isTerminalTournament(tournament) {
  const lifecycle = resolveLifecycle(tournament);
  return lifecycle === 'completed' || lifecycle === 'cancelled';
}

async function getStandings(idOrSlug) {
  const tournament = await loadTournament(idOrSlug);
  if (!tournament) return null;
  if ((tournament.participantType || 'individual') === 'club') {
    await demoteAthleteParticipantsOnClubTournament(tournament.id);
  }
  await recomputeTournamentStandings(tournament.id);
  const participants = await TournamentParticipant.findAll({
    where: { tournamentId: tournament.id },
    include: [
      {
        model: User,
        attributes: ['id', 'firstName', 'lastName', 'role'],
        include: [{ model: Profile, attributes: ['profilePhoto', 'club', 'position'] }],
      },
    ],
  });
  const participantType = tournament.participantType || 'individual';
  const standingParticipants = participantType === 'club'
    ? participants.filter((p) => String(p.User?.role || '').toLowerCase() === 'club')
    : participants;
  const matches = (await Match.findAll({ where: { tournamentId: tournament.id } })).map(plain);
  const ids = standingParticipants.map((p) => p.userId);
  const rows = standingsFromMatches(ids, matches, { headToHead: true });
  const userById = Object.fromEntries(standingParticipants.map((p) => [p.userId, p.User]));
  const metaById = Object.fromEntries(standingParticipants.map((p) => [p.userId, p]));
  const shaped = rows.map((row) => ({
    ...row,
    participantStatus: metaById[row.userId]?.status,
    groupName: metaById[row.userId]?.groupName || null,
    seed: metaById[row.userId]?.seed || null,
    User: userById[row.userId] || null,
  }));

  const byGroup = {};
  for (const participant of standingParticipants) {
    if (!participant.groupName) continue;
    if (!byGroup[participant.groupName]) byGroup[participant.groupName] = [];
    byGroup[participant.groupName].push(participant.userId);
  }
  const groups = Object.keys(byGroup).length ? groupStandings(byGroup, matches, { headToHead: true }) : null;
  const groupedRows = groups
    ? Object.fromEntries(Object.entries(groups).map(([name, table]) => [
      name,
      table.map((row) => ({ ...row, User: userById[row.userId] || null })),
    ]))
    : null;

  return {
    tournamentId: tournament.id,
    tournamentType: tournament.type,
    lifecycle: resolveLifecycle(tournament),
    participantType,
    rankingMode: tournament.type === 'league' || tournament.type === 'group_knockout' ? 'points_table' : 'matches_derived',
    tieBreakers: ['points', 'head_to_head', 'goal_difference', 'goals_scored', 'wins'],
    caption:
      tournament.type === 'league' || tournament.type === 'group_knockout'
        ? 'Tabela sipas pikëve (3-1-0), pastaj ndeshjet direkte, diferenca e golave dhe golat e shënuar. Llogaritet vetëm nga ndeshjet e përfunduara.'
        : 'Për cup/knockout, kjo tabelë përmbledh statistikat nga ndeshjet e përfunduara; kalimi në raund tjetër varet nga bracket-i.',
    rows: shaped,
    groups: groupedRows,
  };
}

async function setMatchLineup({ matchId, user, lineup }) {
  const match = await Match.findByPk(matchId, { include: [{ model: Tournament }] });
  if (!match) throw fail(404, 'Match not found');
  const authz = canManageTournamentMatches(match.Tournament, user);
  if (!authz.ok) throw fail(authz.status, authz.msg);
  const gate = assertResultMutation(match.Tournament);
  if (!gate.ok && resolveLifecycle(match.Tournament) !== 'active' && resolveLifecycle(match.Tournament) !== 'in_progress') {
    throw fail(gate.status || 400, gate.msg);
  }
  const home = Array.isArray(lineup?.home) ? lineup.home.map(Number).filter((id) => Number.isFinite(id)) : [];
  const away = Array.isArray(lineup?.away) ? lineup.away.map(Number).filter((id) => Number.isFinite(id)) : [];
  if (new Set(home).size !== home.length || new Set(away).size !== away.length) {
    throw fail(409, 'Duplicate player in a lineup.');
  }
  await match.update({ lineup: { home, away } });
  return match;
}

async function addMatchEvent({ matchId, user, event }) {
  const match = await Match.findByPk(matchId, { include: [{ model: Tournament }] });
  if (!match) throw fail(404, 'Match not found');
  const authz = canFillMatchStats(match.Tournament, user, match);
  if (!authz.ok) throw fail(authz.status, authz.msg);
  const gate = assertResultMutation(match.Tournament);
  if (!gate.ok) throw fail(gate.status, gate.msg);
  const validated = validateMatchEvent(event, match);
  if (!validated.ok) throw fail(validated.status, validated.msg);
  const duplicate = await MatchEvent.findOne({
    where: { matchId: match.id, eventKey: validated.event.eventKey },
  });
  if (duplicate) throw fail(409, 'Duplicate match event.');
  if (validated.event.userId) await assertPlayerOnSide(match, validated.event.userId, validated.event.side);
  if (validated.event.relatedUserId) await assertPlayerOnSide(match, validated.event.relatedUserId, validated.event.side);

  return sequelize.transaction(async (transaction) => {
    const created = await MatchEvent.create({ ...validated.event, matchId: match.id }, { transaction });
    if (created.type === 'goal' || created.type === 'penalty') {
      await MatchScorer.create(
        {
          matchId: match.id,
          userId: created.userId,
          goals: 1,
          minute: created.minute,
          side: created.side,
          assistUserId: created.type === 'penalty' ? null : null,
        },
        { transaction }
      );
    }
    return created;
  });
}

async function savePlayerStats({ matchId, user, players }) {
  const match = await Match.findByPk(matchId, { include: [{ model: Tournament }] });
  if (!match) throw fail(404, 'Match not found');
  const authz = canFillMatchStats(match.Tournament, user, match);
  if (!authz.ok) throw fail(authz.status, authz.msg);
  const gate = assertResultMutation(match.Tournament);
  if (!gate.ok) throw fail(gate.status, gate.msg);
  if (!Array.isArray(players)) throw fail(400, 'players must be an array.');

  const seen = new Set();
  return sequelize.transaction(async (transaction) => {
    const saved = [];
    for (const row of players) {
      const userId = Number(row.userId);
      if (!Number.isFinite(userId)) throw fail(400, 'Each player stat needs a userId.');
      if (seen.has(userId)) throw fail(409, 'Duplicate player statistics for this match.');
      seen.add(userId);
      await assertPlayerOnSide(match, userId, row.side || (userId === Number(match.homeUserId) ? 'home' : 'away'));
      const payload = {
        matchId: match.id,
        userId,
        side: row.side === 'home' || row.side === 'away' ? row.side : null,
        started: !!row.started,
        minutes: Math.max(0, parseInt(row.minutes, 10) || 0),
        goals: Math.max(0, parseInt(row.goals, 10) || 0),
        assists: Math.max(0, parseInt(row.assists, 10) || 0),
        shots: Math.max(0, parseInt(row.shots, 10) || 0),
        shotsOnTarget: Math.max(0, parseInt(row.shotsOnTarget, 10) || 0),
        passes: Math.max(0, parseInt(row.passes, 10) || 0),
        keyPasses: Math.max(0, parseInt(row.keyPasses, 10) || 0),
        fouls: Math.max(0, parseInt(row.fouls, 10) || 0),
        yellowCards: Math.max(0, parseInt(row.yellowCards, 10) || 0),
        redCards: Math.max(0, parseInt(row.redCards, 10) || 0),
        saves: Math.max(0, parseInt(row.saves, 10) || 0),
        cleanSheet: row.cleanSheet == null ? null : !!row.cleanSheet,
        goalkeeper: !!row.goalkeeper,
        rating: row.rating == null || row.rating === '' ? null : Number(row.rating),
      };
      const [stat] = await PlayerMatchStat.findOrCreate({
        where: { matchId: match.id, userId },
        defaults: payload,
        transaction,
      });
      await stat.update(payload, { transaction });
      saved.push(stat);
    }
    return saved;
  });
}

async function playerStatsForCompetition(idOrSlug) {
  const tournament = await loadTournament(idOrSlug);
  if (!tournament) return null;
  const matches = await Match.findAll({ where: { tournamentId: tournament.id }, attributes: ['id', 'homeUserId', 'awayUserId', 'scoreHome', 'scoreAway', 'status'] });
  const matchIds = matches.map((m) => m.id);
  if (!matchIds.length) return { tournamentId: tournament.id, players: [] };
  const [scorers, events, statRows] = await Promise.all([
    MatchScorer.findAll({ where: { matchId: { [Op.in]: matchIds } } }),
    MatchEvent.findAll({ where: { matchId: { [Op.in]: matchIds } } }),
    PlayerMatchStat.findAll({ where: { matchId: { [Op.in]: matchIds } } }),
  ]);
  const players = aggregatePlayerStats({
    scorers: scorers.map(plain),
    events: events.map(plain),
    statRows: statRows.map(plain),
    matches: matches.map(plain),
  });
  const users = players.length
    ? await User.findAll({
        where: { id: { [Op.in]: players.map((player) => player.userId) } },
        attributes: ['id', 'firstName', 'lastName'],
      })
    : [];
  const names = Object.fromEntries(users.map((user) => [user.id, userLabel(user)]));
  return {
    tournamentId: tournament.id,
    season: tournament.season,
    players: players.map((player) => ({ ...player, name: names[player.userId] || null })),
  };
}

function userLabel(user) {
  if (!user) return null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.Profile?.club || null;
}

async function publicMatchPayload(matchId) {
  const match = await Match.findByPk(matchId, {
    include: [
      { model: Tournament },
      {
        model: User,
        as: 'homeUser',
        attributes: ['id', 'firstName', 'lastName', 'role'],
        include: [{ model: Profile, attributes: ['profilePhoto', 'club', 'position'] }],
      },
      {
        model: User,
        as: 'awayUser',
        attributes: ['id', 'firstName', 'lastName', 'role'],
        include: [{ model: Profile, attributes: ['profilePhoto', 'club', 'position'] }],
      },
      {
        model: MatchScorer,
        required: false,
        include: [{ model: User, attributes: ['id', 'firstName', 'lastName'] }],
      },
      {
        model: MatchEvent,
        as: 'events',
        required: false,
        include: [{ model: User, as: 'player', attributes: ['id', 'firstName', 'lastName'] }],
      },
      {
        model: PlayerMatchStat,
        as: 'playerStats',
        required: false,
        include: [{ model: User, as: 'player', attributes: ['id', 'firstName', 'lastName'] }],
      },
    ],
  });
  if (!match) return null;
  const plainMatch = plain(match);
  return {
    ...plainMatch,
    publicPath: `/matches/${match.id}`,
    homeName: userLabel(plainMatch.homeUser),
    awayName: userLabel(plainMatch.awayUser),
    competition: plainMatch.Tournament
      ? {
          id: plainMatch.Tournament.id,
          name: plainMatch.Tournament.name,
          slug: plainMatch.Tournament.slug,
          type: plainMatch.Tournament.type,
          season: plainMatch.Tournament.season,
          lifecycle: resolveLifecycle(plainMatch.Tournament),
          logo: plainMatch.Tournament.logo || null,
        }
      : null,
  };
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

async function calendarMatches(query = {}) {
  const where = {};
  if (query.competitionId || query.tournamentId) {
    where.tournamentId = query.competitionId || query.tournamentId;
  }
  if (query.status) where.status = query.status;
  const view = String(query.view || 'upcoming');
  const now = new Date();
  if (view === 'today' || query.date) {
    const day = query.date ? new Date(query.date) : now;
    where.matchDate = { [Op.between]: [startOfDay(day), endOfDay(day)] };
  } else if (view === 'week' || view === 'this_week') {
    const start = startOfDay(now);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    where.matchDate = { [Op.between]: [start, end] };
  } else if (view === 'completed') {
    where.status = 'finished';
  } else if (view === 'upcoming') {
    where.status = { [Op.in]: ['scheduled', 'ongoing'] };
    where.matchDate = { [Op.gte]: startOfDay(now) };
  }

  const teamId = query.clubId || query.teamId || query.userId;
  if (teamId) {
    where[Op.or] = [{ homeUserId: teamId }, { awayUserId: teamId }];
  }

  const tournamentWhere = {};
  if (query.season) tournamentWhere.season = query.season;

  let matches = await Match.findAll({
    where,
    include: [
      {
        model: Tournament,
        attributes: ['id', 'name', 'slug', 'type', 'season', 'status', 'lifecycle', 'logo'],
        where: Object.keys(tournamentWhere).length ? tournamentWhere : undefined,
        required: !!query.season,
      },
      { model: User, as: 'homeUser', attributes: ['id', 'firstName', 'lastName'] },
      { model: User, as: 'awayUser', attributes: ['id', 'firstName', 'lastName'] },
    ],
    order: [['matchDate', 'ASC']],
    limit: Math.min(parseInt(query.limit, 10) || 100, 200),
    offset: Math.max(parseInt(query.offset, 10) || 0, 0),
  });

  if (query.playerId) {
    const playerId = Number(query.playerId);
    const ids = matches.map((m) => m.id);
    const [scorers, stats, events] = await Promise.all([
      ids.length ? MatchScorer.findAll({ where: { matchId: { [Op.in]: ids }, [Op.or]: [{ userId: playerId }, { assistUserId: playerId }] } }) : [],
      ids.length ? PlayerMatchStat.findAll({ where: { matchId: { [Op.in]: ids }, userId: playerId } }) : [],
      ids.length ? MatchEvent.findAll({ where: { matchId: { [Op.in]: ids }, [Op.or]: [{ userId: playerId }, { relatedUserId: playerId }] } }) : [],
    ]);
    const allowed = new Set([
      ...scorers.map((s) => s.matchId),
      ...stats.map((s) => s.matchId),
      ...events.map((s) => s.matchId),
    ]);
    matches = matches.filter((m) => allowed.has(m.id) || Number(m.homeUserId) === playerId || Number(m.awayUserId) === playerId);
  }

  return {
    view,
    matches: matches.map((m) => {
      const row = plain(m);
      return {
        ...row,
        publicPath: `/matches/${m.id}`,
        homeName: userLabel(row.homeUser),
        awayName: userLabel(row.awayUser),
      };
    }),
  };
}

async function applyLifecycle({ tournamentId, user, lifecycle }) {
  const tournament = await loadTournament(tournamentId);
  if (!tournament) throw fail(404, 'Tournament not found');
  const authz = canManageTournamentMatches(tournament, user);
  if (!authz.ok) throw fail(authz.status, authz.msg);
  const next = canTransition(resolveLifecycle(tournament), lifecycle);
  if (!next.ok) throw fail(next.status, next.msg);
  if (next.lifecycle === 'active' || next.lifecycle === 'in_progress') {
    const count = await Match.count({ where: { tournamentId: tournament.id } });
    if (!count) throw fail(400, 'Generate fixtures before starting the competition.');
  }
  if (next.lifecycle === 'completed') {
    const open = await Match.count({
      where: { tournamentId: tournament.id, status: { [Op.notIn]: ['finished', 'walkover', 'cancelled'] } },
    });
    if (open) throw fail(400, 'Finish every match before completing the competition.');
  }
  tournament.lifecycle = next.lifecycle;
  tournament.status = next.status;
  await tournament.save();
  return tournament;
}

module.exports = {
  fail,
  loadTournament,
  recomputeTournamentStandings,
  startCompetition,
  recordOfficialResult,
  updateLiveMatch,
  assertManualFixture,
  assertScheduledDate: (tournament, matchDate) => {
    const message = dateWindowError(tournament, matchDate);
    if (message) throw fail(400, message);
  },
  getStandings,
  addMatchEvent,
  setMatchLineup,
  savePlayerStats,
  playerStatsForCompetition,
  publicMatchPayload,
  calendarMatches,
  applyLifecycle,
  winnerOfStoredMatch,
};
