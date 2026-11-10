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
const Video = require('../models/Video');
const MediaItem = require('../models/MediaItem');
const Stream = require('../models/Stream');
const ScoutingReport = require('../models/ScoutingReport');
const TournamentSquadMember = require('../models/TournamentSquadMember');
const TournamentClubEntry = require('../models/TournamentClubEntry');
const TournamentClubPlayerStat = require('../models/TournamentClubPlayerStat');
const CompetitionAuditEvent = require('../models/CompetitionAuditEvent');
const ClubMember = require('../models/ClubMember');
const ClubStaff = require('../models/ClubStaff');
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
  roundRobinFixtures,
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
const { createAthleteIdentityKey, normalizeAthleteIdentityKey } = require('../utils/athleteIdentity');

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
  if (squad) return;
  if (match.tournamentId) {
    const member = await ClubMember.findOne({ where: { clubId: teamUserId, athleteId: id, status: 'approved' } });
    if (member) return;
  }
  throw fail(400, 'Player is not on this team for the competition.');
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
  const entries = await TournamentClubEntry.findAll({ where: { tournamentId }, transaction });
  if (entries.length) {
    const matches = (await Match.findAll({ where: { tournamentId }, transaction })).map(plain);
    const ids = entries.map((entry) => Number(entry.id));
    const entryByClub = new Map(entries.filter((entry) => entry.clubUserId).map((entry) => [Number(entry.clubUserId), Number(entry.id)]));
    const entryMatches = matches.map((match) => ({
      ...match,
      homeUserId: match.homeClubEntryId ? Number(match.homeClubEntryId) : entryByClub.get(Number(match.homeUserId)) || null,
      awayUserId: match.awayClubEntryId ? Number(match.awayClubEntryId) : entryByClub.get(Number(match.awayUserId)) || null,
    }));
    const computed = standingsFromMatches(ids, entryMatches, { headToHead: true });
    const byId = new Map(computed.map((row) => [Number(row.userId), row]));
    for (const entry of entries) {
      const row = byId.get(Number(entry.id)) || {};
      await entry.update({
        played: row.played || 0, wins: row.wins || 0, draws: row.draws || 0, losses: row.losses || 0,
        goalsFor: row.goalsFor || 0, goalsAgainst: row.goalsAgainst || 0, points: row.points || 0,
      }, { transaction });
    }
    return computed;
  }
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
    const walkover = !!fixture.walkover || (fixture.awayUserId == null && fixture.awayClubEntryId == null);
    const match = await Match.create(
      {
        tournamentId: tournament.id,
        homeUserId: fixture.homeUserId,
        awayUserId: walkover ? null : fixture.awayUserId,
        homeClubEntryId: fixture.homeClubEntryId || null,
        awayClubEntryId: walkover ? null : (fixture.awayClubEntryId || null),
        homeName: fixture.homeName || null,
        awayName: walkover ? null : (fixture.awayName || null),
        status: walkover ? 'walkover' : 'scheduled',
        round: fixture.round || 1,
        roundLabel: fixture.roundLabel || null,
        groupName: fixture.groupName || null,
        stage: fixture.stage || null,
        matchDate: fixture.matchDate || tournament.startDate || new Date(),
        scoreHome: walkover ? null : null,
        scoreAway: walkover ? null : null,
        winnerUserId: walkover ? fixture.homeUserId : null,
        winnerClubEntryId: walkover ? (fixture.homeClubEntryId || null) : null,
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

async function removeUnplayedLigaFixtures(tournament, matches, transaction) {
  const matchIds = matches.map((match) => Number(match.id));
  if (!matchIds.length) return;

  const queryOptions = { where: { matchId: { [Op.in]: matchIds } }, transaction };
  const hasReferences = await Promise.all([
    MatchEvent.count(queryOptions),
    MatchScorer.count(queryOptions),
    PlayerMatchStat.count(queryOptions),
    Video.count(queryOptions),
    MediaItem.count(queryOptions),
    Stream.count(queryOptions),
    ScoutingReport.count(queryOptions),
  ]);
  if (hasReferences.some((count) => count > 0)) {
    throw fail(409, 'Orari nuk mund të rindërtohet: disa ndeshje kanë rezultate, statistika ose përmbajtje të lidhur.');
  }

  const untouched = matches.every((match) =>
    match.status === 'scheduled' &&
    match.scoreHome == null && match.scoreAway == null &&
    match.winnerUserId == null && match.halfTimeHome == null && match.halfTimeAway == null &&
    match.extraTimeHome == null && match.extraTimeAway == null &&
    match.penaltiesHome == null && match.penaltiesAway == null &&
    match.lineup == null && match.clockMinute == null &&
    match.refereeUserId == null && match.refereeName == null && match.venue == null && match.highlightsUrl == null &&
    Number(match.goals || 0) === 0 && Number(match.assists || 0) === 0
  );
  if (!untouched) {
    throw fail(409, 'Orari nuk mund të rindërtohet sepse përmban ndeshje të luajtura ose të përditësuara.');
  }

  await Bracket.destroy({ where: { tournamentId: tournament.id }, transaction });
  await Match.destroy({ where: { tournamentId: tournament.id }, transaction });
}

async function startCompetition({ tournamentId, user, options = {} }) {
  const tournament = await loadTournament(tournamentId);
  if (!tournament) throw fail(404, 'Tournament not found');
  const authz = canManageTournamentMatches(tournament, user);
  if (!authz.ok) throw fail(authz.status, authz.msg);

  const isLigaCompetition = Boolean(tournament.ligaId || tournament.sourceRole === 'liga');
  const clubEntries = isLigaCompetition
    ? await TournamentClubEntry.findAll({ where: { tournamentId: tournament.id }, order: [['groupName', 'ASC'], ['clubName', 'ASC']] })
    : [];
  const hasExistingFixtures = await Match.count({ where: { tournamentId: tournament.id } });
  if (isLigaCompetition && tournament.participantType !== 'club') {
    tournament.participantType = 'club';
    await tournament.save();
  }
  // Older league tournaments had no home/away control and defaulted to one leg.
  // Use the expected double round-robin unless the current request explicitly opts out.
  if (
    isLigaCompetition && tournament.type === 'league' && !hasExistingFixtures &&
    !tournament.homeAndAway && options.homeAndAway === undefined
  ) {
    tournament.homeAndAway = true;
    await tournament.save();
  }
  if (options.repairFixtures === true && isLigaCompetition && tournament.type === 'league') {
    tournament.homeAndAway = true;
    await tournament.save();
  }
  if (isLigaCompetition) {
    await demoteAthleteParticipantsOnClubTournament(tournament.id);
  }

  const participants = await TournamentParticipant.findAll({
    where: { tournamentId: tournament.id },
    include: [{ model: User, attributes: ['id', 'role'] }],
  });
  const participantType = isLigaCompetition ? 'club' : tournament.participantType || 'individual';
  const standing = participantType === 'club'
    ? participants.filter((p) => String(p.User?.role || '').toLowerCase() === 'club')
    : participants;
  const accepted = acceptedParticipants(standing);
  const leagueEntryMode = isLigaCompetition && clubEntries.length > 0;
  const gate = assertCanStart(tournament, leagueEntryMode ? clubEntries.length : accepted.length);
  const repairingExistingLigaSchedule = options.repairFixtures === true &&
    isLigaCompetition && tournament.type === 'league';
  if (!gate.ok && !repairingExistingLigaSchedule) throw fail(gate.status, gate.msg);

  const seeded = [...accepted].sort((a, b) => {
    const sa = a.seed == null ? 9999 : Number(a.seed);
    const sb = b.seed == null ? 9999 : Number(b.seed);
    if (sa !== sb) return sa - sb;
    return Number(a.userId) - Number(b.userId);
  });

  const doubleRound = options.homeAndAway != null ? !!options.homeAndAway : !!tournament.homeAndAway;
  const groupCount = options.groupsCount || tournament.groupsCount || undefined;
  let plan = planCompetitionFixtures(
    leagueEntryMode ? clubEntries.map((entry) => entry.id) : seeded.map((p) => p.userId),
    {
      type: tournament.type,
      doubleRound,
      groupCount,
      startDate: options.startDate || tournament.startDate,
      endDate: options.endDate || tournament.endDate,
    }
  );
  // Liga-created club tournaments may have explicit group assignments. Keep
  // the existing automatic seeding for all other tournaments, but honor those
  // saved assignments when the league has selected them.
  if (leagueEntryMode) {
    if (clubEntries.length < 2) throw fail(400, 'Cakto të paktën dy ekipe për turneun.');
    const byEntryId = new Map(clubEntries.map((entry) => [Number(entry.id), entry]));
    const expectedClubIds = new Set(clubEntries.map((entry) => Number(entry.id)));
    if (tournament.type === 'group_knockout') {
      const groupsByName = new Map();
      for (const entry of clubEntries) {
        const clubId = Number(entry.id);
        if (!expectedClubIds.has(clubId)) continue;
        const groupName = String(entry.groupName || 'A').trim().toUpperCase();
        if (!groupsByName.has(groupName)) groupsByName.set(groupName, []);
        groupsByName.get(groupName).push(clubId);
      }
      const groups = [...groupsByName.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, teamIds]) => ({ name, teamIds }));
      if (groups.some((group) => group.teamIds.length < 2)) {
        throw fail(400, 'Çdo grup i turneut duhet të ketë të paktën dy klube.');
      }
      const assignedIds = new Set(groups.flatMap((group) => group.teamIds));
      if (assignedIds.size !== expectedClubIds.size || [...expectedClubIds].some((id) => !assignedIds.has(id))) {
        throw fail(400, 'Cakto grup për çdo klub të regjistruar përpara nisjes së turneut.');
      }
      const fixtures = groups.flatMap((group) => roundRobinFixtures(group.teamIds, {
        doubleRound,
        stage: 'group',
        groupName: group.name,
      }));
      const duplicates = findDuplicateFixtures(fixtures, { doubleRound });
      if (duplicates.length) throw fail(400, 'Gjenerimi i ndeshjeve krijoi çiftime të përsëritura.');
      const dated = scheduleFixtureDates(fixtures, {
        startDate: options.startDate || tournament.startDate,
        endDate: options.endDate || tournament.endDate,
      });
      if (!dated.ok) throw fail(400, dated.msg);
      plan = { ok: true, groups, fixtures: dated.fixtures };
    } else if (tournament.type === 'league') {
      const fixtures = roundRobinFixtures([...expectedClubIds], { doubleRound, stage: 'league' });
      const dated = scheduleFixtureDates(fixtures, {
        startDate: options.startDate || tournament.startDate,
        endDate: options.endDate || tournament.endDate,
      });
      if (!dated.ok) throw fail(400, dated.msg);
      plan = { ok: true, groups: null, fixtures: dated.fixtures };
    }
    plan.fixtures = plan.fixtures.map((fixture) => {
      const home = byEntryId.get(Number(fixture.homeUserId));
      const away = fixture.awayUserId == null ? null : byEntryId.get(Number(fixture.awayUserId));
      return { ...fixture,
        homeUserId: home?.clubUserId || null,
        awayUserId: away?.clubUserId || null,
        homeClubEntryId: home?.id || null,
        awayClubEntryId: away?.id || null,
        homeName: home?.clubName || null,
        awayName: away?.clubName || null,
      };
    });
  }
  if (!plan.ok) throw fail(400, plan.msg);

  let existingMatchesToRepair = [];
  if (hasExistingFixtures > 0) {
    if (options.repairFixtures !== true || !isLigaCompetition || tournament.type !== 'league') {
      throw fail(409, 'Fixtures already exist for this competition.');
    }
    const existingMatches = await Match.findAll({ where: { tournamentId: tournament.id } });
    const expectedIds = new Set(seeded.map((participant) => Number(participant.userId)));
    const scheduleMatchesCurrentClubs = existingMatches.every((match) =>
      expectedIds.has(Number(match.homeUserId)) && expectedIds.has(Number(match.awayUserId))
    );
    const actualFixtureKeys = existingMatches
      .map((match) => `${Number(match.homeUserId)}:${Number(match.awayUserId)}`)
      .sort();
    const expectedFixtureKeys = plan.fixtures
      .map((fixture) => `${Number(fixture.homeUserId)}:${Number(fixture.awayUserId)}`)
      .sort();
    const scheduleMatchesFormat = existingMatches.length === plan.fixtures.length &&
      scheduleMatchesCurrentClubs && Boolean(tournament.homeAndAway) &&
      actualFixtureKeys.every((key, index) => key === expectedFixtureKeys[index]);
    if (scheduleMatchesFormat) throw fail(409, 'Orari ekzistues përputhet tashmë me klubet dhe formatin e ligës.');
    existingMatchesToRepair = existingMatches;
  }

  const created = await sequelize.transaction(async (transaction) => {
    const lockedTournament = await Tournament.findByPk(tournament.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!lockedTournament) throw fail(404, 'Tournament not found');
    const currentMatches = await Match.findAll({ where: { tournamentId: tournament.id }, transaction });
    if (existingMatchesToRepair.length) {
      const expectedIds = new Set(existingMatchesToRepair.map((match) => Number(match.id)));
      if (currentMatches.length !== expectedIds.size || currentMatches.some((match) => !expectedIds.has(Number(match.id)))) {
        throw fail(409, 'Orari ndryshoi gjatë rindërtimit. Rifresko turneun dhe provo përsëri.');
      }
    } else if (currentMatches.length) {
      throw fail(409, 'Ndeshjet u krijuan nga një kërkesë tjetër. Rifresko turneun.');
    }
    if (existingMatchesToRepair.length) {
      await removeUnplayedLigaFixtures(tournament, existingMatchesToRepair, transaction);
    }
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
      if (leagueEntryMode) {
        for (const entry of clubEntries) {
          const groupName = groupByUser[Number(entry.id)];
          if (groupName) await entry.update({ groupName }, { transaction });
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
        `${tournament.name} has started! Check your match schedule.`,
        { idempotencyKey: `tournament-started:${tournament.id}:user:${participant.userId}`, eventType: 'COMPETITION_UPDATE' }
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
      const entries = await TournamentClubEntry.findAll({ where: { tournamentId: tournament.id }, transaction });
      const entryById = new Map(entries.map((entry) => [Number(entry.id), entry]));
      const entryByClub = new Map(entries.filter((entry) => entry.clubUserId).map((entry) => [Number(entry.clubUserId), entry]));
      const canResolveEntry = (entryId, clubId) => entryId
        ? entryById.has(Number(entryId))
        : clubId == null || entryByClub.has(Number(clubId));
      const entryMode = entries.length > 0 && groupMatches.every((match) =>
        canResolveEntry(match.homeClubEntryId, match.homeUserId) && canResolveEntry(match.awayClubEntryId, match.awayUserId));
      const participants = entryMode ? [] : await TournamentParticipant.findAll({
        where: { tournamentId: tournament.id, status: 'accepted' }, transaction,
      });
      const mapEntryId = (entryId, clubId) => entryId
        ? Number(entryId)
        : Number(entryByClub.get(Number(clubId))?.id) || null;
      const qualificationMatches = entryMode ? groupMatches.map((match) => {
        const homeEntryId = mapEntryId(match.homeClubEntryId, match.homeUserId);
        const awayEntryId = mapEntryId(match.awayClubEntryId, match.awayUserId);
        if (!homeEntryId || (match.awayUserId != null && !awayEntryId)) {
          throw fail(409, 'Ndeshja e grupit ka klub që nuk është pjesëmarrës në turne.');
        }
        return {
          ...match,
          groupName: String(match.groupName || '').trim().toUpperCase(),
          homeUserId: -homeEntryId,
          awayUserId: awayEntryId ? -awayEntryId : null,
        };
      }) : groupMatches;
      const byGroup = {};
      const qualifiers = entryMode ? entries : participants;
      for (const participant of qualifiers) {
        const groupName = String(participant.groupName || '').trim().toUpperCase();
        if (!groupName) continue;
        if (!byGroup[groupName]) byGroup[groupName] = [];
        byGroup[groupName].push(entryMode ? -Number(participant.id) : participant.userId);
      }
      const tables = groupStandings(byGroup, qualificationMatches, { headToHead: true });
      const qualified = planGroupQualification(tables, tournament.qualifyPerGroup || 2);
      if (!qualified.ok) return { advanced: false, reason: qualified.msg };
      const dated = scheduleFixtureDates(qualified.fixtures, {
        startDate: new Date(),
        endDate: tournament.endDate,
      });
      const fixtures = dated.ok ? dated.fixtures : qualified.fixtures.map((f) => ({ ...f, matchDate: new Date() }));
      const duplicates = findDuplicateFixtures(fixtures);
      if (duplicates.length) throw fail(409, 'Knockout bracket would duplicate a fixture.');
      const nextFixtures = entryMode ? fixtures.map((fixture) => {
        const home = entryById.get(Math.abs(Number(fixture.homeUserId)));
        const away = fixture.awayUserId == null ? null : entryById.get(Math.abs(Number(fixture.awayUserId)));
        if (!home || (fixture.awayUserId != null && !away)) throw fail(409, 'Kualifikimi i grupit përmban klub që nuk ekziston më.');
        return {
          ...fixture,
          homeUserId: home.clubUserId || null,
          awayUserId: away?.clubUserId || null,
          homeClubEntryId: home.id,
          awayClubEntryId: away?.id || null,
          homeName: home.clubName,
          awayName: away?.clubName || null,
        };
      }) : fixtures;
      await createPlannedMatches(tournament, nextFixtures, transaction);
      return { advanced: true, kind: 'group_knockout', entryMode };
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
    const entries = await TournamentClubEntry.findAll({ where: { tournamentId: tournament.id }, transaction });
    const entryById = new Map(entries.map((entry) => [Number(entry.id), entry]));
    const entryByClub = new Map(entries.filter((entry) => entry.clubUserId).map((entry) => [Number(entry.clubUserId), entry]));
    const entryMode = entries.length > 0 && current.every((match) => {
      const homeExists = match.homeClubEntryId
        ? entryById.has(Number(match.homeClubEntryId))
        : entryByClub.has(Number(match.homeUserId));
      const awayExists = match.awayUserId == null || (match.awayClubEntryId
        ? entryById.has(Number(match.awayClubEntryId))
        : entryByClub.has(Number(match.awayUserId)));
      return homeExists && awayExists;
    });
    const entryMatches = entryMode ? current.map((match) => {
      const homeEntryId = Number(match.homeClubEntryId || entryByClub.get(Number(match.homeUserId))?.id) || null;
      const awayEntryId = match.awayClubEntryId
        ? Number(match.awayClubEntryId)
        : match.awayUserId == null
          ? null
          : Number(entryByClub.get(Number(match.awayUserId))?.id) || null;
      if (!homeEntryId || (match.awayUserId != null && !awayEntryId)) {
        throw fail(409, 'Ndeshja knockout ka pjesëmarrës që nuk është i lidhur me klubin e turneut.');
      }
      const winnerEntryId = Number(match.winnerClubEntryId || entryByClub.get(Number(match.winnerUserId))?.id) || null;
      return {
        ...match,
        homeUserId: -homeEntryId,
        awayUserId: awayEntryId ? -awayEntryId : null,
        winnerUserId: winnerEntryId ? -winnerEntryId : null,
      };
    }) : current;
    const plan = planKnockoutAdvancement(entryMatches);
    if (!plan.ok) return { advanced: false, reason: plan.reason };
    if (plan.championUserId) {
      tournament.lifecycle = 'completed';
      tournament.status = legacyStatusFor('completed');
      await tournament.save({ transaction });
      const championEntry = entryMode ? entryById.get(Math.abs(Number(plan.championUserId))) : null;
      return {
        advanced: true,
        championUserId: championEntry ? (championEntry.clubUserId || null) : plan.championUserId,
        ...(championEntry ? { championClubEntryId: championEntry.id, championName: championEntry.clubName } : {}),
      };
    }
    const dated = scheduleFixtureDates(plan.fixtures, {
      startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      endDate: tournament.endDate,
    });
    const plannedFixtures = dated.ok ? dated.fixtures : plan.fixtures;
    const fixtures = entryMode ? plannedFixtures.map((fixture) => {
      const home = entryById.get(Math.abs(Number(fixture.homeUserId)));
      const away = fixture.awayUserId == null ? null : entryById.get(Math.abs(Number(fixture.awayUserId)));
      if (!home || (fixture.awayUserId != null && !away)) throw fail(409, 'Raundi tjetër përmban klub që nuk ekziston më.');
      return {
        ...fixture,
        homeUserId: home.clubUserId || null,
        awayUserId: away?.clubUserId || null,
        homeClubEntryId: home.id,
        awayClubEntryId: away?.id || null,
        homeName: home.clubName,
        awayName: away?.clubName || null,
        winnerUserId: fixture.winnerUserId ? (entryById.get(Math.abs(Number(fixture.winnerUserId)))?.clubUserId || null) : null,
        winnerClubEntryId: fixture.winnerUserId ? Math.abs(Number(fixture.winnerUserId)) : null,
      };
    }) : plannedFixtures;
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
  const isLiga = Boolean(tournament.ligaId || tournament.sourceRole === 'liga');
  const authz = canFillMatchStats(tournament, user, match);
  if (!authz.ok) throw fail(authz.status, authz.msg);
  const gate = assertResultMutation(tournament);
  if (!gate.ok && !(isLiga && resolveLifecycle(tournament) === 'completed')) throw fail(gate.status, gate.msg);
  if (match.status === 'finished' && resolveLifecycle(tournament) === 'completed' && !isLiga) {
    throw fail(409, 'Completed competition is locked. Results cannot be changed.');
  }

  const validationHomeId = match.homeClubEntryId ? -Number(match.homeClubEntryId) : match.homeUserId;
  const validationAwayId = match.awayClubEntryId ? -Number(match.awayClubEntryId) : match.awayUserId;
  const validated = validateOfficialResult({
    ...payload,
    competitionType: tournament.type,
    stage: match.stage,
    groupName: match.groupName,
    homeUserId: validationHomeId,
    awayUserId: validationAwayId,
  });
  if (!validated.ok) throw fail(validated.status, validated.msg);

  const goalEvents = payload.goalEvents || payload.scorers;
  if (Array.isArray(goalEvents)) {
    for (const event of goalEvents) {
      if (!event?.userId && !event?.athleteName) continue;
      const side = event.side || (event.userId ? (Number(event.userId) === Number(match.homeUserId) ? 'home' : 'away') : null);
      if (!['home', 'away'].includes(side)) throw fail(400, 'Skuadra e golashënuesit është e detyrueshme.');
      if (event.userId) await assertPlayerOnSide(match, event.userId, side);
      if (event.assistUserId) {
        await assertPlayerOnSide(match, event.assistUserId, side);
      }
    }
  }

  return sequelize.transaction(async (transaction) => {
    const lockedTournament = await Tournament.findByPk(tournament.id, { transaction, lock: transaction.LOCK.UPDATE });
    const lockedMatch = await Match.findByPk(match.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!lockedTournament || !lockedMatch) throw fail(404, 'Ndeshja ose turneu nuk u gjet.');
    const lockedAuthz = canFillMatchStats(lockedTournament, user, lockedMatch);
    if (!lockedAuthz.ok) throw fail(lockedAuthz.status, lockedAuthz.msg);
    const lockedGate = assertResultMutation(lockedTournament);
    if (!lockedGate.ok && !(isLiga && resolveLifecycle(lockedTournament) === 'completed')) throw fail(lockedGate.status, lockedGate.msg);

    if (!Array.isArray(goalEvents)) {
      const existingScorers = await MatchScorer.findAll({ where: { matchId: lockedMatch.id }, transaction });
      const scorerGoals = { home: 0, away: 0 };
      for (const scorer of existingScorers) {
        const side = scorer.side || (Number(scorer.userId) === Number(lockedMatch.homeUserId) ? 'home' : Number(scorer.userId) === Number(lockedMatch.awayUserId) ? 'away' : null);
        if (side) scorerGoals[side] += Number(scorer.goals) || 0;
      }
      const officialGoals = {
        home: Number(validated.patch.scoreHome || 0) + Number(validated.patch.extraTimeHome || 0),
        away: Number(validated.patch.scoreAway || 0) + Number(validated.patch.extraTimeAway || 0),
      };
      if (scorerGoals.home > officialGoals.home || scorerGoals.away > officialGoals.away) {
        throw fail(409, 'Përditëso golashënuesit bashkë me rezultatin që statistikat të përputhen.');
      }
    }

    await lockedMatch.update(
      {
        ...validated.patch,
        winnerUserId: validated.patch.winnerUserId === validationHomeId ? lockedMatch.homeUserId : validated.patch.winnerUserId === validationAwayId ? lockedMatch.awayUserId : null,
        winnerClubEntryId: validated.patch.winnerUserId === validationHomeId ? (lockedMatch.homeClubEntryId || null) : validated.patch.winnerUserId === validationAwayId ? (lockedMatch.awayClubEntryId || null) : null,
        refereeName: payload.refereeName !== undefined ? payload.refereeName : lockedMatch.refereeName,
        refereeUserId: payload.refereeUserId !== undefined ? payload.refereeUserId : lockedMatch.refereeUserId,
        venue: payload.venue !== undefined ? payload.venue : lockedMatch.venue,
        highlightsUrl: payload.highlightsUrl !== undefined ? payload.highlightsUrl : lockedMatch.highlightsUrl,
        clockPhase: 'FT',
      },
      { transaction }
    );

    if (Array.isArray(goalEvents)) {
      await saveMatchGoalEvents(lockedMatch.id, goalEvents, lockedMatch, { transaction, actorUserId: user?.id });
    }

    if (resolveLifecycle(lockedTournament) === 'active') {
      lockedTournament.lifecycle = 'in_progress';
      lockedTournament.status = legacyStatusFor('in_progress');
      await lockedTournament.save({ transaction });
    }

    await recomputeTournamentStandings(lockedTournament.id, transaction);
    const advancement = await maybeAdvance(lockedTournament, transaction);
    return { match: lockedMatch, tournament: lockedTournament, advancement, goalEvents };
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
  const isLiga = Boolean(tournament.ligaId || tournament.sourceRole === 'liga');
  if (!isLiga && tournament.startDate && when < new Date(tournament.startDate)) {
    return 'Match date is before the competition starts.';
  }
  if (!isLiga && tournament.endDate && when > new Date(tournament.endDate)) {
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

async function createLeagueFixture({ tournamentId, user, payload = {} }) {
  const tournament = await loadTournament(tournamentId);
  if (!tournament) throw fail(404, 'Turneu nuk u gjet.');
  const authz = canManageTournamentMatches(tournament, user);
  if (!authz.ok) throw fail(authz.status, authz.msg);
  if (!(tournament.ligaId || tournament.sourceRole === 'liga')) throw fail(400, 'Ndeshjet manuale mund t’i menaxhojë vetëm liga.');
  if (!['active', 'in_progress'].includes(resolveLifecycle(tournament))) throw fail(409, 'Nise turneun përpara se të shtosh ndeshje manuale.');
  const matchDate = payload.matchDate;
  const dateError = dateWindowError(tournament, matchDate);
  if (dateError) throw fail(400, dateError);
  return sequelize.transaction(async (transaction) => {
    // Serialize fixture mutations for this tournament so simultaneous requests
    // cannot both pass the duplicate check.
    const lockedTournament = await Tournament.findByPk(tournament.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!lockedTournament) throw fail(404, 'Turneu nuk u gjet.');
    const homeEntry = await TournamentClubEntry.findOne({ where: { id: payload.homeClubEntryId, tournamentId: tournament.id }, transaction });
    const awayEntry = await TournamentClubEntry.findOne({ where: { id: payload.awayClubEntryId, tournamentId: tournament.id }, transaction });
    if (!homeEntry || !awayEntry) throw fail(400, 'Zgjidh dy ekipe pjesëmarrëse në këtë turne.');
    if (Number(homeEntry.id) === Number(awayEntry.id)) throw fail(400, 'Një ekip nuk mund të luajë kundër vetes.');
    const round = Math.max(1, Number.parseInt(payload.round, 10) || 1);
    const groupName = String(payload.groupName || homeEntry.groupName || '').trim().slice(0, 8) || null;
    const candidate = {
      homeUserId: -Number(homeEntry.id),
      awayUserId: -Number(awayEntry.id),
      round,
      groupName,
      stage: 'league',
    };
    const existing = await Match.findAll({ where: { tournamentId: tournament.id }, transaction });
    const duplicate = existing.some((row) => {
      const item = plain(row);
      return fixtureIdentity({
        ...item,
        homeUserId: item.homeClubEntryId ? -Number(item.homeClubEntryId) : item.homeUserId,
        awayUserId: item.awayClubEntryId ? -Number(item.awayClubEntryId) : item.awayUserId,
      }, { doubleRound: !!tournament.homeAndAway }) === fixtureIdentity(candidate, { doubleRound: !!tournament.homeAndAway });
    });
    if (duplicate) throw fail(409, 'Kjo ndeshje ekziston tashmë.');
    const match = await Match.create({
      tournamentId: tournament.id,
      homeUserId: homeEntry.clubUserId || null,
      awayUserId: awayEntry.clubUserId || null,
      homeClubEntryId: homeEntry.id,
      awayClubEntryId: awayEntry.id,
      homeName: homeEntry.clubName,
      awayName: awayEntry.clubName,
      matchDate,
      round,
      roundLabel: String(payload.roundLabel || '').trim().slice(0, 40) || null,
      groupName,
      stage: 'league',
      venue: String(payload.venue || '').trim().slice(0, 160) || null,
      refereeName: String(payload.refereeName || '').trim().slice(0, 120) || null,
      status: 'scheduled',
    }, { transaction });
    await CompetitionAuditEvent.create({
      tournamentId: tournament.id,
      matchId: match.id,
      actorUserId: Number(user.id),
      eventType: 'fixture_created',
      metadata: { source: 'league_manual', homeClubEntryId: homeEntry.id, awayClubEntryId: awayEntry.id },
    }, { transaction });
    return match;
  });
}

async function deleteLeagueFixture({ matchId, user }) {
  const match = await Match.findByPk(matchId, { include: [{ model: Tournament }] });
  if (!match) throw fail(404, 'Ndeshja nuk u gjet.');
  const authz = canManageTournamentMatches(match.Tournament, user);
  if (!authz.ok) throw fail(authz.status, authz.msg);
  if (!(match.Tournament.ligaId || match.Tournament.sourceRole === 'liga')) throw fail(400, 'Vetëm liga mund ta fshijë këtë ndeshje.');
  const refs = await Promise.all([
    Video.count({ where: { matchId: match.id } }), MediaItem.count({ where: { matchId: match.id } }),
    Stream.count({ where: { matchId: match.id } }), ScoutingReport.count({ where: { matchId: match.id } }),
  ]);
  if (refs.some(Boolean)) throw fail(409, 'Ndeshja ka video, transmetim ose raport të lidhur dhe nuk mund të fshihet.');
  await sequelize.transaction(async (transaction) => {
    const lockedTournament = await Tournament.findByPk(match.tournamentId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!lockedTournament) throw fail(404, 'Turneu nuk u gjet.');
    const lockedMatch = await Match.findByPk(match.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!lockedMatch) throw fail(404, 'Ndeshja nuk u gjet.');
    const lockedAuthz = canManageTournamentMatches(lockedTournament, user);
    if (!lockedAuthz.ok) throw fail(lockedAuthz.status, lockedAuthz.msg);
    await CompetitionAuditEvent.create({
      tournamentId: lockedTournament.id,
      matchId: lockedMatch.id,
      actorUserId: Number(user.id),
      eventType: 'fixture_deleted',
      metadata: {
        homeClubEntryId: lockedMatch.homeClubEntryId || null,
        awayClubEntryId: lockedMatch.awayClubEntryId || null,
        homeName: lockedMatch.homeName || null,
        awayName: lockedMatch.awayName || null,
        status: lockedMatch.status,
        scoreHome: lockedMatch.scoreHome,
        scoreAway: lockedMatch.scoreAway,
      },
    }, { transaction });
    await Promise.all([
      MatchScorer.destroy({ where: { matchId: lockedMatch.id }, transaction }),
      MatchEvent.destroy({ where: { matchId: lockedMatch.id }, transaction }),
      PlayerMatchStat.destroy({ where: { matchId: lockedMatch.id }, transaction }),
      Bracket.destroy({ where: { matchId: lockedMatch.id }, transaction }),
    ]);
    await lockedMatch.destroy({ transaction });
    await recomputeTournamentStandings(lockedTournament.id, transaction);
  });
  return { success: true };
}

async function updateLeagueFixture({ matchId, user, payload = {} }) {
  const match = await Match.findByPk(matchId, { include: [{ model: Tournament }] });
  if (!match) throw fail(404, 'Ndeshja nuk u gjet.');
  const authz = canManageTournamentMatches(match.Tournament, user);
  if (!authz.ok) throw fail(authz.status, authz.msg);
  if (!(match.Tournament.ligaId || match.Tournament.sourceRole === 'liga')) throw fail(400, 'Vetëm liga mund ta ndryshojë këtë ndeshje.');
  const patch = {};
  if (payload.matchDate !== undefined) {
    const dateError = dateWindowError(match.Tournament, payload.matchDate);
    if (dateError) throw fail(400, dateError);
    patch.matchDate = payload.matchDate;
  }
  if (payload.venue !== undefined) patch.venue = String(payload.venue || '').trim().slice(0, 160) || null;
  if (payload.refereeName !== undefined) patch.refereeName = String(payload.refereeName || '').trim().slice(0, 120) || null;
  if (payload.roundLabel !== undefined) patch.roundLabel = String(payload.roundLabel || '').trim().slice(0, 40) || null;
  if (payload.groupName !== undefined) patch.groupName = String(payload.groupName || '').trim().slice(0, 8) || null;
  if (Object.keys(patch).length) {
    await sequelize.transaction(async (transaction) => {
      const lockedTournament = await Tournament.findByPk(match.tournamentId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!lockedTournament) throw fail(404, 'Turneu nuk u gjet.');
      const lockedMatch = await Match.findByPk(match.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!lockedMatch) throw fail(404, 'Ndeshja nuk u gjet.');
      const lockedAuthz = canManageTournamentMatches(lockedTournament, user);
      if (!lockedAuthz.ok) throw fail(lockedAuthz.status, lockedAuthz.msg);
      if (!(lockedTournament.ligaId || lockedTournament.sourceRole === 'liga')) throw fail(400, 'Vetëm liga mund ta ndryshojë këtë ndeshje.');
      await lockedMatch.update(patch, { transaction });
      await CompetitionAuditEvent.create({
        tournamentId: lockedTournament.id,
        matchId: lockedMatch.id,
        actorUserId: Number(user.id),
        eventType: 'fixture_updated',
        metadata: { changedFields: Object.keys(patch) },
      }, { transaction });
    });
    await match.reload();
  }
  return match;
}

function isTerminalTournament(tournament) {
  const lifecycle = resolveLifecycle(tournament);
  return lifecycle === 'completed' || lifecycle === 'cancelled';
}

async function getStandings(idOrSlug) {
  const tournament = await loadTournament(idOrSlug);
  if (!tournament) return null;
  // A read computes its response from authoritative matches. Do not repair or
  // demote persisted rows as a side effect of GET /standings.
  const leagueEntries = await TournamentClubEntry.findAll({
    where: { tournamentId: tournament.id },
    order: [['groupName', 'ASC'], ['clubName', 'ASC']],
    include: [{ model: User, as: 'club', attributes: ['id', 'firstName', 'lastName', 'role'], required: false, include: [{ model: Profile, attributes: ['profilePhoto', 'club', 'position'] }] }],
  });
  if (leagueEntries.length) {
    const entryByClub = new Map(leagueEntries.filter((entry) => entry.clubUserId).map((entry) => [Number(entry.clubUserId), Number(entry.id)]));
    const matches = (await Match.findAll({ where: { tournamentId: tournament.id } })).map(plain).map((match) => ({
      ...match,
      homeUserId: match.homeClubEntryId ? Number(match.homeClubEntryId) : entryByClub.get(Number(match.homeUserId)) || null,
      awayUserId: match.awayClubEntryId ? Number(match.awayClubEntryId) : entryByClub.get(Number(match.awayUserId)) || null,
    }));
    const rows = standingsFromMatches(leagueEntries.map((entry) => entry.id), matches, { headToHead: true });
    const byId = new Map(leagueEntries.map((entry) => [Number(entry.id), entry]));
    const shape = (row) => {
      const entry = byId.get(Number(row.userId));
      return { ...row, userId: entry?.clubUserId || null, clubEntryId: entry?.id, clubName: entry?.clubName, groupName: entry?.groupName || null, User: entry?.club || null };
    };
    const shaped = rows.map(shape);
    const groupNames = [...new Set(leagueEntries.map((entry) => entry.groupName).filter(Boolean))];
    const groups = groupNames.length ? Object.fromEntries(groupNames.map((name) => {
      const ids = leagueEntries.filter((entry) => entry.groupName === name).map((entry) => Number(entry.id));
      return [name, standingsFromMatches(ids, matches, { headToHead: true }).map(shape)];
    })) : null;
    return {
      tournamentId: tournament.id,
      tournamentType: tournament.type,
      lifecycle: resolveLifecycle(tournament),
      participantType: 'club',
      rankingMode: 'points_table',
      tieBreakers: ['points', 'head_to_head', 'goal_difference', 'goals_scored', 'wins'],
      caption: 'Tabela sipas pikëve (3-1-0); përfshihen klubet me profil dhe klubet e futura manualisht.',
      rows: shaped,
      groups,
    };
  }
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
  const participantType = tournament.ligaId || tournament.sourceRole === 'liga'
    ? 'club'
    : tournament.participantType || 'individual';
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
  const completedLiga = Boolean(match.Tournament.ligaId || match.Tournament.sourceRole === 'liga') && resolveLifecycle(match.Tournament) === 'completed';
  if (!gate.ok && !completedLiga) throw fail(gate.status, gate.msg);
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
  const tournament = match.Tournament;
  const manager = canFillMatchStats(tournament, user, match);
  const isLiga = Boolean(tournament?.ligaId || tournament?.sourceRole === 'liga');
  const sideEntries = {};
  if (isLiga) {
    for (const side of ['home', 'away']) {
      const entryId = side === 'home' ? match.homeClubEntryId : match.awayClubEntryId;
      const clubId = side === 'home' ? match.homeUserId : match.awayUserId;
      sideEntries[side] = entryId
        ? await TournamentClubEntry.findByPk(entryId)
        : (clubId ? await TournamentClubEntry.findOne({ where: { tournamentId: tournament.id, clubUserId: clubId } }) : null);
    }
  }
  const entryMode = isLiga && Boolean(sideEntries.home || sideEntries.away);
  let allowedSides = manager.ok ? ['home', 'away'] : [];
  const unknownAllowed = manager.ok && entryMode;
  if (!manager.ok && entryMode && (user?.role === 'club' || user?.role === 'coach')) {
    const actor = await User.findByPk(user.id, { attributes: ['id', 'role', 'adminVerified', 'bannedAt', 'deletedAt'] });
    if (!actor || actor.bannedAt || actor.deletedAt) throw fail(403, 'Llogaria nuk është e autorizuar.');
    for (const side of ['home', 'away']) {
      const entry = sideEntries[side];
      if (!entry) continue;
      const club = entry?.clubUserId ? await User.findByPk(entry.clubUserId, { attributes: ['id', 'role', 'adminVerified', 'bannedAt', 'deletedAt'] }) : null;
      if (!club || club.role !== 'club' || !club.adminVerified || club.bannedAt || club.deletedAt) continue;
      let authorized = actor.role === 'club' && Number(actor.id) === Number(club.id) && actor.adminVerified === true;
      if (actor.role === 'coach') {
        const staff = await ClubStaff.findOne({ where: { clubId: club.id, staffId: actor.id, status: 'active', leftAt: null, staffRole: { [Op.in]: ['head_coach', 'assistant_coach', 'fitness_coach', 'goalkeeper_coach', 'technical_coach', 'tactical_coach', 'team_manager'] } } });
        const until = staff?.contractUntil;
        const expiry = until && String(until).toLowerCase() !== 'vazhdon'
          ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(until) ? `${until}T23:59:59.999Z` : until)
          : null;
        authorized = Boolean(staff && (!expiry || (Number.isFinite(expiry.getTime()) && expiry >= new Date())));
      }
      if (authorized) allowedSides.push(side);
    }
  }
  if (!allowedSides.length) throw fail(403, 'Vetëm liga ose klubi/stafi aktiv i skuadrës mund të vendosë statistikat.');
  const gate = assertResultMutation(match.Tournament);
  const completedLiga = Boolean(match.Tournament.ligaId || match.Tournament.sourceRole === 'liga') && resolveLifecycle(match.Tournament) === 'completed';
  if (!gate.ok && !completedLiga) throw fail(gate.status, gate.msg);
  if (!Array.isArray(players)) throw fail(400, 'players must be an array.');

  const seen = new Set();
  return sequelize.transaction(async (transaction) => {
    const normalizedRows = [];
    const scorerRowsForIdentity = await MatchScorer.findAll({ where: { matchId: match.id }, transaction });
    for (const row of players) {
      const parsedUserId = row.userId == null || row.userId === '' ? null : Number(row.userId);
      const userId = Number.isInteger(parsedUserId) && parsedUserId > 0 ? parsedUserId : null;
      const side = row.side === 'home' || row.side === 'away' ? row.side : null;
      const athleteName = String(row.athleteName || '').trim().replace(/\s+/g, ' ').slice(0, 160) || null;
      if (!side || !allowedSides.includes(side)) throw fail(403, 'Nuk mund të ndryshoni statistikat e skuadrës tjetër.');
      if (!userId && (!unknownAllowed || !athleteName)) throw fail(400, 'Lojtari i panjohur mund të regjistrohet vetëm nga liga me emër dhe skuadër.');
      let athleteIdentityKey = null;
      if (!userId) {
        athleteIdentityKey = normalizeAthleteIdentityKey(row.athleteIdentityKey);
        if (row.athleteIdentityKey && !athleteIdentityKey) throw fail(400, 'Identiteti i lojtarit është i pavlefshëm.');
        const entry = sideEntries[side];
        const normalizedName = (value) => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
        if (entry) {
          const identityRows = await TournamentClubPlayerStat.findAll({ where: { tournamentClubEntryId: entry.id }, transaction });
          if (athleteIdentityKey) {
            const ownedIdentity = identityRows.find((item) => item.athleteIdentityKey === athleteIdentityKey);
            if (!ownedIdentity || normalizedName(ownedIdentity.athleteName) !== normalizedName(athleteName)) {
              throw fail(403, 'Identiteti i panjohur nuk i përket skuadrës së kësaj ndeshjeje.');
            }
          } else {
            const matchingIds = new Set(identityRows.filter((item) => normalizedName(item.athleteName) === normalizedName(athleteName)).map((item) => item.athleteIdentityKey));
            for (const scorer of scorerRowsForIdentity) {
              if (scorer.side === side && !scorer.userId && normalizedName(scorer.athleteName) === normalizedName(athleteName) && scorer.athleteIdentityKey) matchingIds.add(scorer.athleteIdentityKey);
            }
            if (matchingIds.size > 1) throw fail(409, 'Ka disa atletë me këtë emër. Zgjidh identitetin e saktë para ruajtjes.');
            athleteIdentityKey = matchingIds.values().next().value || createAthleteIdentityKey();
            if (!matchingIds.size) {
              await TournamentClubPlayerStat.create({
                tournamentClubEntryId: entry.id,
                athleteIdentityKey,
                athleteName,
                goals: 0,
                assists: 0,
                updatedByUserId: user.id,
              }, { transaction });
            }
          }
        } else if (!athleteIdentityKey) {
          const matching = new Set(scorerRowsForIdentity
            .filter((scorer) => scorer.side === side && !scorer.userId && normalizedName(scorer.athleteName) === normalizedName(athleteName))
            .map((scorer) => scorer.athleteIdentityKey).filter(Boolean));
          if (matching.size > 1) throw fail(409, 'Ka disa atletë me këtë emër. Dërgo identitetin e saktë.');
          athleteIdentityKey = matching.values().next().value || createAthleteIdentityKey();
        }
      }
      const identity = userId ? `u:${userId}` : `i:${athleteIdentityKey}`;
      if (seen.has(identity)) throw fail(409, 'Statistikat e lojtarit janë përsëritur.');
      seen.add(identity);
      if (userId) {
        const sideEntry = sideEntries[side];
        if (sideEntry) {
          const entry = sideEntry;
          if (!entry?.clubUserId) throw fail(400, 'Për klub pa profil, shënuesi duhet regjistruar me emër dhe jo me llogari të një klubi tjetër.');
          const member = await ClubMember.findOne({ where: { clubId: entry.clubUserId, athleteId: userId, status: 'approved' } });
          if (!member) throw fail(403, 'Lojtari nuk është anëtar i aprovuar i klubit.');
        } else {
          await assertPlayerOnSide(match, userId, side);
        }
      }
      const payload = {
        matchId: match.id,
        userId,
        athleteName,
        athleteIdentityKey,
        side,
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
      if (payload.minutes > 180 || payload.goals > 20 || payload.assists > 20 || payload.yellowCards > 5 || payload.redCards > 2) throw fail(400, 'Vlerat e statistikave janë jashtë kufijve të lejuar.');
      normalizedRows.push(payload);
    }
    for (const side of allowedSides) {
      const sideWhere = { matchId: match.id, side };
      // allowedSides is already derived from verified league/club/coach access.
      // Replacing that side's submitted sheet must also replace unknown athletes,
      // whose userId is null, or edits would silently accumulate duplicate rows.
      await PlayerMatchStat.destroy({ where: sideWhere, transaction });
    }
    const officialScore = { home: Number(match.scoreHome), away: Number(match.scoreAway) };
    if (match.status !== 'finished' || !Number.isInteger(officialScore.home) || !Number.isInteger(officialScore.away)) {
      throw fail(409, 'Liga duhet ta ruajë rezultatin zyrtar para statistikave të lojtarëve.');
    }
    const scorerRows = await MatchScorer.findAll({ where: { matchId: match.id }, transaction });
    for (const side of allowedSides) {
      const sideUserId = Number(side === 'home' ? match.homeUserId : match.awayUserId);
      const scorers = scorerRows.filter((scorer) => scorer.side === side || (!scorer.side && Number(scorer.userId) === sideUserId));
      const scorerGoalCount = scorers.reduce((sum, scorer) => sum + Number(scorer.goals || 0), 0);
      const scorerGoalsByPlayer = new Map();
      for (const scorer of scorers) {
        const key = scorer.userId ? `u:${scorer.userId}` : `i:${scorer.athleteIdentityKey}`;
        scorerGoalsByPlayer.set(key, (scorerGoalsByPlayer.get(key) || 0) + Number(scorer.goals || 0));
      }
      const additionalStatGoals = normalizedRows.filter((row) => row.side === side).reduce((sum, row) => {
        const key = row.userId ? `u:${row.userId}` : `i:${row.athleteIdentityKey}`;
        return sum + Math.max(0, row.goals - (scorerGoalsByPlayer.get(key) || 0));
      }, 0);
      if (scorerGoalCount + additionalStatGoals > officialScore[side]) throw fail(400, `Golat e lojtarëve nuk mund të kalojnë rezultatin zyrtar të skuadrës ${side === 'home' ? 'vendase' : 'mysafire'}.`);
      const scorerAssistsByPlayer = new Map();
      for (const scorer of scorers) if (scorer.assistUserId) scorerAssistsByPlayer.set(`u:${scorer.assistUserId}`, (scorerAssistsByPlayer.get(`u:${scorer.assistUserId}`) || 0) + 1);
      const scorerAssistCount = [...scorerAssistsByPlayer.values()].reduce((sum, value) => sum + value, 0);
      const assistCount = scorerAssistCount + normalizedRows.filter((row) => row.side === side).reduce((sum, row) => {
        const key = row.userId ? `u:${row.userId}` : `i:${row.athleteIdentityKey}`;
        return sum + Math.max(0, row.assists - (scorerAssistsByPlayer.get(key) || 0));
      }, 0);
      if (assistCount > officialScore[side]) throw fail(400, `Asistet e lojtarëve nuk mund të kalojnë numrin e golave zyrtarë të skuadrës.`);
    }
    return PlayerMatchStat.bulkCreate(normalizedRows, { transaction, returning: true });
  });
}

async function playerStatsForCompetition(idOrSlug) {
  const tournament = await loadTournament(idOrSlug);
  if (!tournament) return null;
  const matches = await Match.findAll({ where: { tournamentId: tournament.id }, attributes: ['id', 'homeUserId', 'awayUserId', 'scoreHome', 'scoreAway', 'status', 'lineup'] });
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
      { model: TournamentClubEntry, as: 'homeClubEntry', attributes: ['id', 'clubName', 'clubUserId'], required: false },
      { model: TournamentClubEntry, as: 'awayClubEntry', attributes: ['id', 'clubName', 'clubUserId'], required: false },
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
    homeName: plainMatch.homeName || plainMatch.homeClubEntry?.clubName || userLabel(plainMatch.homeUser),
    awayName: plainMatch.awayName || plainMatch.awayClubEntry?.clubName || userLabel(plainMatch.awayUser),
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
    // Include overdue scheduled fixtures so they remain visible for organizers
    // to reschedule or record, instead of disappearing from every calendar view.
    where.status = { [Op.in]: ['scheduled', 'ongoing'] };
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
  createLeagueFixture,
  updateLeagueFixture,
  deleteLeagueFixture,
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
