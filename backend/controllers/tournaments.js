const { Tournament, TournamentParticipant } = require('../models/Tournament');
const Match = require('../models/Match');
const Bracket = require('../models/Bracket');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Liga = require('../models/Liga');
const { MatchScorer } = require('../models');
const { Op } = require('sequelize');
const { notifyMessage, notifyTournament } = require('./notifications');
const { resolveTournamentSeason } = require('../utils/footballSeason');
const { saveMatchGoalEvents, sumGoalsForSide } = require('../utils/matchGoalEvents');
const {
  ALLOWED_CREATOR_ROLES,
  normalizeCategory,
} = require('../utils/ligaTournaments');
const { canManageTournamentMatches, canFillMatchStats } = require('../utils/matchPermissions');

/** Siguron që çdo pjesëmarrës ka userId/id të user-it (jo id të rreshtit në TournamentParticipant). */
function serializeTournamentParticipants(participants) {
  if (!Array.isArray(participants)) return [];
  return participants.map((p) => {
    const j = p && typeof p.toJSON === 'function' ? p.toJSON() : { ...p };
    const through = j.TournamentParticipant || j.tournament_participant || {};
    const userId = Number(through.userId ?? j.userId ?? j.id);
    const safeUserId = Number.isFinite(userId) && userId > 0 ? userId : null;
    const {
      TournamentParticipant: _tp,
      tournament_participant: _tp2,
      ...rest
    } = j;
    return {
      ...rest,
      id: safeUserId,
      userId: safeUserId,
      participantStatus: through.status ?? j.participantStatus ?? 'accepted',
      points: through.points ?? j.points,
      wins: through.wins ?? j.wins,
      draws: through.draws ?? j.draws,
      losses: through.losses ?? j.losses,
      goalsFor: through.goalsFor ?? j.goalsFor,
      goalsAgainst: through.goalsAgainst ?? j.goalsAgainst,
    };
  });
}

function serializeTournament(tournament) {
  if (!tournament) return tournament;
  const j = tournament && typeof tournament.toJSON === 'function' ? tournament.toJSON() : { ...tournament };
  return {
    ...j,
    participants: serializeTournamentParticipants(j.participants),
  };
}

exports.createTournament = async (req, res) => {
  try {
    const role = req.user?.role;
    if (!ALLOWED_CREATOR_ROLES.has(role)) {
      return res.status(403).json({
        msg: 'Vetëm liga, klubi ose scout mund të krijojnë turne. Lojtarët nuk mund të krijojnë turne.',
      });
    }

    const { description, type, startDate, endDate, maxParticipants, participantType, season } = req.body;
    let name = String(req.body.name || '').trim();
    const category = normalizeCategory(req.body.category);
    let ligaId = null;
    let pt = 'individual';
    if (participantType === 'club') pt = 'club';
    else if (participantType === 'mixed') pt = 'mixed';

    if (role === 'liga') {
      const liga = await Liga.findOne({ where: { userId: req.user.id } });
      if (!liga) {
        return res.status(400).json({ msg: 'Krijoni profilin e ligës së pari.' });
      }
      name = liga.name;
      ligaId = liga.id;
      // Liga tournaments register athletes for goals/assists, not clubs as entities
      pt = 'individual';

      const existing = await Tournament.findOne({
        where: { ligaId: liga.id, category },
      });
      if (existing) {
        return res.status(200).json(existing);
      }
    } else if (!name) {
      return res.status(400).json({ msg: 'Emri i turneut është i detyrueshëm.' });
    }

    let resolvedSeason;
    try {
      resolvedSeason = resolveTournamentSeason({ type, startDate, season });
    } catch (seasonErr) {
      return res.status(400).json({ msg: seasonErr.message });
    }

    const tournament = await Tournament.create({
      name,
      description,
      type,
      season: resolvedSeason,
      startDate,
      endDate,
      maxParticipants,
      participantType: pt,
      creatorId: req.user.id,
      ligaId,
      sourceRole: role,
      category,
    });
    res.status(201).json(tournament);
  } catch (err) {
    console.error('createTournament:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getTournaments = async (req, res) => {
  try {
    const tournaments = await Tournament.findAll({
      include: [
        { model: User, as: 'creator', attributes: ['firstName', 'lastName'] },
        { model: User, as: 'participants', attributes: ['id', 'firstName', 'lastName', 'role'], through: { attributes: [] } },
      ],
    });
    res.json(tournaments.map(serializeTournament));
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Trending tournaments (created inside the platform)
exports.getTrendingTournaments = async (req, res) => {
  try {
    const statusFilter = req.query.status || 'open';

    const tournaments = await Tournament.findAll({
      where: statusFilter ? { status: statusFilter } : {},
      include: [
        { model: User, as: 'creator', attributes: ['id', 'firstName', 'lastName'] },
        { model: User, as: 'participants', attributes: ['id', 'firstName', 'lastName', 'role'], through: { attributes: [] } },
      ],
    });

    // Only platform-created tournaments (creatorId present)
    const platformCreated = tournaments.filter(t => !!t.creatorId);

    // Sort by participants count desc, then newest first
    platformCreated.sort((a, b) => {
      const pa = (a.participants && a.participants.length) || 0;
      const pb = (b.participants && b.participants.length) || 0;
      if (pb !== pa) return pb - pa;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Return top 5 by default
    res.json(platformCreated.slice(0, 5).map(serializeTournament));
  } catch (err) {
    console.error('Get trending tournaments error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getTournament = async (req, res) => {
  try {
    const tournament = await Tournament.findByPk(req.params.id, {
      include: [
        { model: User, as: 'creator', attributes: ['firstName', 'lastName'] },
        {
          model: User,
          as: 'participants',
          attributes: ['id', 'firstName', 'lastName', 'role'],
          through: { attributes: ['points', 'wins', 'draws', 'losses', 'goalsFor', 'goalsAgainst', 'status'] },
          include: [{ model: Profile, attributes: ['profilePhoto', 'club', 'position'] }],
        },
        { model: Match, include: [{ model: User, as: 'homeUser' }, { model: User, as: 'awayUser' }] },
      ],
    });
    if (!tournament) return res.status(404).json({ msg: 'Tournament not found' });
    res.json(serializeTournament(tournament));
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.joinTournament = async (req, res) => {
  try {
    const tournament = await Tournament.findByPk(req.params.id);
    if (!tournament) return res.status(404).json({ msg: 'Tournament not found' });
    if (tournament.status !== 'open') return res.status(400).json({ msg: 'Tournament not open for joining' });

    const participantType = tournament.participantType || 'individual';
    if (participantType === 'club' && req.user.role !== 'club') {
      return res.status(400).json({
        msg: 'Ky turne është vetëm për klube — vetëm llogaria me rol «club» mund të bashkohet.',
      });
    }
    if (participantType === 'mixed' && !['club', 'athlete'].includes(req.user.role)) {
      return res.status(400).json({
        msg: 'Ky turne pranon vetëm klube dhe athletë. Përdorni një llogari «club» ose «athlete».',
      });
    }
    if (participantType === 'individual' && req.user.role === 'club') {
      return res.status(400).json({
        msg: 'Ky turne është për individë (jo klub si pjesëmarrës). Zgjidhni turne «klub», «klub + athletë» ose krijoni turne për klube.',
      });
    }

    const participants = await TournamentParticipant.findAll({ where: { tournamentId: req.params.id } });
    if (participants.length >= tournament.maxParticipants) return res.status(400).json({ msg: 'Tournament full' });

    const already = participants.some((p) => p.userId === req.user.id);
    if (already) return res.status(400).json({ msg: 'Already joined this tournament' });

    await TournamentParticipant.create({ tournamentId: req.params.id, userId: req.user.id });
    res.json({ msg: 'Joined tournament' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

/** Renditje: ligë = pikë + diferencë gola (FIFA); cup/knockout = nga ndeshjet e përfunduara (përmbledhje), bracket për eliminim. */
function sortStandingsRows(rows) {
  return [...rows].sort((a, b) => {
    const pa = a.points ?? 0;
    const pb = b.points ?? 0;
    if (pb !== pa) return pb - pa;
    const gda = (a.goalsFor ?? 0) - (a.goalsAgainst ?? 0);
    const gdb = (b.goalsFor ?? 0) - (b.goalsAgainst ?? 0);
    if (gdb !== gda) return gdb - gda;
    const gfa = a.goalsFor ?? 0;
    const gfb = b.goalsFor ?? 0;
    if (gfb !== gfa) return gfb - gfa;
    return (b.wins ?? 0) - (a.wins ?? 0);
  });
}

async function standingsFromFinishedMatches(tournamentId, participantUserIds) {
  const ids = [...new Set(participantUserIds.map(Number))].filter((id) => Number.isFinite(id));
  const stats = {};
  for (const uid of ids) {
    stats[uid] = {
      userId: uid,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    };
  }
  const matches = await Match.findAll({
    where: { tournamentId, status: 'finished' },
    attributes: ['homeUserId', 'awayUserId', 'scoreHome', 'scoreAway'],
  });
  for (const m of matches) {
    const h = m.homeUserId;
    const a = m.awayUserId;
    if (!stats[h] || !stats[a]) continue;
    const sh = Number(m.scoreHome) || 0;
    const sa = Number(m.scoreAway) || 0;
    stats[h].played += 1;
    stats[a].played += 1;
    stats[h].goalsFor += sh;
    stats[h].goalsAgainst += sa;
    stats[a].goalsFor += sa;
    stats[a].goalsAgainst += sh;
    if (sh > sa) {
      stats[h].wins += 1;
      stats[h].points += 3;
      stats[a].losses += 1;
    } else if (sa > sh) {
      stats[a].wins += 1;
      stats[a].points += 3;
      stats[h].losses += 1;
    } else {
      stats[h].draws += 1;
      stats[a].draws += 1;
      stats[h].points += 1;
      stats[a].points += 1;
    }
  }
  return Object.values(stats).map((r) => ({
    ...r,
    goalDifference: r.goalsFor - r.goalsAgainst,
  }));
}

exports.getStandings = async (req, res) => {
  try {
    const tournament = await Tournament.findByPk(req.params.id);
    if (!tournament) return res.status(404).json({ msg: 'Tournament not found' });

    const participants = await TournamentParticipant.findAll({
      where: { tournamentId: req.params.id },
      include: [
        {
          model: User,
          attributes: ['id', 'firstName', 'lastName', 'role'],
          include: [{ model: Profile, attributes: ['profilePhoto', 'club', 'position'] }],
        },
      ],
    });

    const fromTable = participants.map((p) => {
      const gf = Number(p.goalsFor) || 0;
      const ga = Number(p.goalsAgainst) || 0;
      return {
        userId: p.userId,
        played: (Number(p.wins) || 0) + (Number(p.draws) || 0) + (Number(p.losses) || 0),
        points: Number(p.points) || 0,
        wins: Number(p.wins) || 0,
        draws: Number(p.draws) || 0,
        losses: Number(p.losses) || 0,
        goalsFor: gf,
        goalsAgainst: ga,
        goalDifference: gf - ga,
        participantStatus: p.status,
        User: p.User,
      };
    });

    let rankingMode;
    let rows;

    if (tournament.type === 'league') {
      rankingMode = 'points_table';
      rows = sortStandingsRows(fromTable).map((r, i) => ({ rank: i + 1, ...r }));
    } else {
      rankingMode = 'matches_derived';
      const ids = participants.map((p) => p.userId);
      const derived = sortStandingsRows(await standingsFromFinishedMatches(tournament.id, ids));
      const userById = Object.fromEntries(participants.map((p) => [p.userId, p.User]));
      rows = derived.map((r, i) => ({
        rank: i + 1,
        userId: r.userId,
        played: r.played,
        points: r.points,
        wins: r.wins,
        draws: r.draws,
        losses: r.losses,
        goalsFor: r.goalsFor,
        goalsAgainst: r.goalsAgainst,
        goalDifference: r.goalDifference,
        User: userById[r.userId] || null,
      }));
    }

    res.json({
      tournamentId: tournament.id,
      tournamentType: tournament.type,
      participantType: tournament.participantType || 'individual',
      rankingMode,
      caption:
        tournament.type === 'league'
          ? 'Tabela sipas pikëve (3 për fitore, 1 për barazim, 0 për humbje), pastaj diferenca e golave, gola të shënuar, fitore.'
          : 'Për cup/knockout, kjo tabelë përmbledh statistikat nga ndeshjet e përfunduara; kalimi në raund tjetër varet nga bracket-i / rezultatet.',
      rows,
    });
  } catch (err) {
    console.error('getStandings:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getLeaderboard = async (req, res) => {
  try {
    const participants = await TournamentParticipant.findAll({
      where: { tournamentId: req.params.id },
      include: [
        {
          model: User,
          attributes: ['id', 'firstName', 'lastName', 'role'],
          include: [{ model: Profile, attributes: ['profilePhoto', 'position', 'club'] }],
        },
      ],
      order: [['points', 'DESC'], ['wins', 'DESC'], ['goalsFor', 'DESC']],
    });
    res.json(participants);
  } catch (err) {
    console.error('Get leaderboard error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Generate bracket for knockout tournament
exports.generateBracket = async (req, res) => {
  try {
    const tournament = await Tournament.findByPk(req.params.id);
    if (!tournament) return res.status(404).json({ msg: 'Tournament not found' });
    if (tournament.creatorId !== req.user.id) {
      return res.status(403).json({ msg: 'Only creator can generate bracket' });
    }
    if (tournament.type !== 'knockout' && tournament.type !== 'cup') {
      return res.status(400).json({ msg: 'Only knockout/cup tournaments have brackets' });
    }

    // Get all participants
    const participants = await TournamentParticipant.findAll({
      where: { tournamentId: req.params.id },
      include: [{ model: User }],
    });

    if (participants.length < 2) {
      return res.status(400).json({ msg: 'Need at least 2 participants' });
    }

    // Shuffle and pair participants
    const shuffled = participants.sort(() => 0.5 - Math.random());
    const round = 1;
    const matches = [];

    for (let i = 0; i < shuffled.length; i += 2) {
      if (i + 1 < shuffled.length) {
        const match = await Match.create({
          tournamentId: req.params.id,
          homeUserId: shuffled[i].userId,
          awayUserId: shuffled[i + 1].userId,
          round,
          status: 'scheduled',
          matchDate: new Date(Date.now() + Math.floor(i / 2) * 86400000),
        });

        await Bracket.create({
          tournamentId: req.params.id,
          round,
          position: Math.floor(i / 2),
          matchId: match.id,
        });

        matches.push(match);
      }
    }

    await tournament.update({ status: 'ongoing' });
    res.json({ msg: 'Bracket generated', matches });
  } catch (err) {
    console.error('Generate bracket error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Get bracket structure
exports.getBracket = async (req, res) => {
  try {
    const brackets = await Bracket.findAll({
      where: { tournamentId: req.params.id },
      include: [
        {
          model: Match,
          include: [
            {
              model: User,
              as: 'homeUser',
              attributes: ['id', 'firstName', 'lastName'],
              include: [{ model: Profile, attributes: ['profilePhoto'] }],
            },
            {
              model: User,
              as: 'awayUser',
              attributes: ['id', 'firstName', 'lastName'],
              include: [{ model: Profile, attributes: ['profilePhoto'] }],
            },
          ],
        },
      ],
      order: [['round', 'ASC'], ['position', 'ASC']],
    });

    // Group by rounds
    const rounds = {};
    brackets.forEach(bracket => {
      if (!rounds[bracket.round]) {
        rounds[bracket.round] = [];
      }
      rounds[bracket.round].push(bracket);
    });

    res.json(rounds);
  } catch (err) {
    console.error('Get bracket error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Update match score (live)
exports.updateMatchScore = async (req, res) => {
  try {
    const { matchId } = req.params;
    const { scoreHome, scoreAway, status, goalEvents, scorers } = req.body;

    const match = await Match.findByPk(matchId, {
      include: [{ model: Tournament }],
    });

    if (!match) return res.status(404).json({ msg: 'Match not found' });

    const authz = canFillMatchStats(match.Tournament, req.user, match);
    if (!authz.ok) return res.status(authz.status).json({ msg: authz.msg });

    await match.update({ scoreHome, scoreAway, status });

  if (Array.isArray(goalEvents) || Array.isArray(scorers)) {
      await saveMatchGoalEvents(match.id, goalEvents || scorers, match);
    }

    // If match finished, update standings
    if (status === 'finished') {
      await updateStandings(match);

      if (match.Tournament.type === 'knockout' || match.Tournament.type === 'cup') {
        await tryAdvanceKnockoutRound(match);
      }
    }

    res.json(match);
  } catch (err) {
    console.error('Update match score error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Helper: Update standings after match
async function updateStandings(match) {
  const { tournamentId, homeUserId, awayUserId, scoreHome, scoreAway } = match;

  const homeParticipant = await TournamentParticipant.findOne({
    where: { tournamentId, userId: homeUserId },
  });
  const awayParticipant = await TournamentParticipant.findOne({
    where: { tournamentId, userId: awayUserId },
  });

  if (!homeParticipant || !awayParticipant) return;

  // Update goals
  homeParticipant.goalsFor += scoreHome;
  homeParticipant.goalsAgainst += scoreAway;
  awayParticipant.goalsFor += scoreAway;
  awayParticipant.goalsAgainst += scoreHome;

  // Update points and W/D/L
  if (scoreHome > scoreAway) {
    homeParticipant.wins += 1;
    homeParticipant.points += 3;
    awayParticipant.losses += 1;
  } else if (scoreHome < scoreAway) {
    awayParticipant.wins += 1;
    awayParticipant.points += 3;
    homeParticipant.losses += 1;
  } else {
    homeParticipant.draws += 1;
    homeParticipant.points += 1;
    awayParticipant.draws += 1;
    awayParticipant.points += 1;
  }

  await homeParticipant.save();
  await awayParticipant.save();
}

/** When an entire knockout round is finished, pair winners into the next round (or end the tournament). */
async function tryAdvanceKnockoutRound(match) {
  const tournament =
    match.Tournament || (await Tournament.findByPk(match.tournamentId));
  if (!tournament || (tournament.type !== 'knockout' && tournament.type !== 'cup')) {
    return;
  }

  const { tournamentId, round } = match;
  const currentRoundMatches = await Match.findAll({
    where: { tournamentId, round },
  });

  if (!currentRoundMatches.length) return;

  const allFinished = currentRoundMatches.every((m) => m.status === 'finished');
  if (!allFinished) return;

  const sh = Number(match.scoreHome);
  const sa = Number(match.scoreAway);
  if (!Number.isFinite(sh) || !Number.isFinite(sa) || sh === sa) return;

  const nextRound = round + 1;
  const nextRoundExists = await Match.count({ where: { tournamentId, round: nextRound } });
  if (nextRoundExists > 0) return;

  const winners = currentRoundMatches.map((m) => {
    const h = Number(m.scoreHome) || 0;
    const a = Number(m.scoreAway) || 0;
    return h > a ? m.homeUserId : m.awayUserId;
  });

  if (winners.length === 1) {
    tournament.status = 'finished';
    await tournament.save();
    await notifyTournament(
      winners[0],
      tournamentId,
      'Tournament Winner! 🏆',
      `Congratulations! You won ${tournament.name}!`
    );
    return;
  }

  const nextRoundMatches = [];
  for (let i = 0; i < winners.length; i += 2) {
    if (i + 1 < winners.length) {
      nextRoundMatches.push({
        tournamentId,
        homeUserId: winners[i],
        awayUserId: winners[i + 1],
        status: 'scheduled',
        round: nextRound,
        matchDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      });
    }
  }

  if (winners.length % 2 === 1) {
    nextRoundMatches.push({
      tournamentId,
      homeUserId: winners[winners.length - 1],
      awayUserId: null,
      status: 'scheduled',
      round: nextRound,
      matchDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    });
  }

  if (!nextRoundMatches.length) return;

  const created = await Match.bulkCreate(nextRoundMatches);
  for (let i = 0; i < created.length; i += 1) {
    await Bracket.create({
      tournamentId,
      round: nextRound,
      position: i,
      matchId: created[i].id,
    });
  }
}

// Get tournament matches
exports.getMatches = async (req, res) => {
  try {
    const { status, round } = req.query;
    const where = { tournamentId: req.params.id };

    if (status) where.status = status;
    if (round) where.round = parseInt(round);

    const matches = await Match.findAll({
      where,
      include: [
        {
          model: User,
          as: 'homeUser',
          attributes: ['id', 'firstName', 'lastName', 'role'],
          include: [{ model: Profile, attributes: ['profilePhoto', 'club'] }],
        },
        {
          model: User,
          as: 'awayUser',
          attributes: ['id', 'firstName', 'lastName', 'role'],
          include: [{ model: Profile, attributes: ['profilePhoto', 'club'] }],
        },
      ],
      order: [['round', 'ASC'], ['matchDate', 'ASC']],
    });

    res.json(matches);
  } catch (err) {
    console.error('Get matches error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

/** Detaj i plotë i një ndeshjeje brenda turneut (për modal statistikash). */
exports.getTournamentMatchDetail = async (req, res) => {
  try {
    const tournamentId = parseInt(req.params.id, 10);
    const matchId = parseInt(req.params.matchId, 10);
    if (!Number.isFinite(tournamentId) || !Number.isFinite(matchId)) {
      return res.status(400).json({ msg: 'ID të pavlefshëm' });
    }

    const match = await Match.findOne({
      where: { id: matchId, tournamentId },
      include: [
        {
          model: Tournament,
          attributes: ['id', 'name', 'type', 'status', 'participantType'],
        },
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
          include: [
            {
              model: User,
              attributes: ['id', 'firstName', 'lastName', 'role'],
              include: [{ model: Profile, attributes: ['profilePhoto', 'position'] }],
            },
            {
              model: User,
              as: 'assistUser',
              attributes: ['id', 'firstName', 'lastName', 'role'],
              required: false,
            },
          ],
        },
      ],
    });

    if (!match) return res.status(404).json({ msg: 'Match not found' });

    const scorers = (match.MatchScorers || [])
      .slice()
      .sort((a, b) => {
        const ma = a.minute != null ? Number(a.minute) : 9999;
        const mb = b.minute != null ? Number(b.minute) : 9999;
        if (ma !== mb) return ma - mb;
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
    const homeId = match.homeUserId;
    const awayId = match.awayUserId;
    const homeScorers = scorers.filter((s) => s.side === 'home' || (!s.side && Number(s.userId) === Number(homeId)));
    const awayScorers = scorers.filter((s) => s.side === 'away' || (!s.side && Number(s.userId) === Number(awayId)));

    res.json({
      match,
      scorersBySide: { home: homeScorers, away: awayScorers },
      scorerTotals: {
        home: sumGoalsForSide(scorers, 'home', homeId),
        away: sumGoalsForSide(scorers, 'away', awayId),
      },
    });
  } catch (err) {
    console.error('getTournamentMatchDetail:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Schedule match
exports.scheduleMatch = async (req, res) => {
  try {
    const { matchId } = req.params;
    const { matchDate } = req.body;

    const match = await Match.findByPk(matchId, {
      include: [{ model: Tournament }],
    });

    if (!match) return res.status(404).json({ msg: 'Match not found' });
    const authz = canManageTournamentMatches(match.Tournament, req.user);
    if (!authz.ok) return res.status(authz.status).json({ msg: authz.msg });

    await match.update({ matchDate });

  // Notify participants
    const scheduleText = `Your match has been scheduled for ${new Date(matchDate).toLocaleString()}`;
    if (match.homeUserId) {
      await notifyTournament(match.homeUserId, match.tournamentId, 'Match Scheduled', scheduleText);
    }
    if (match.awayUserId) {
      await notifyTournament(match.awayUserId, match.tournamentId, 'Match Scheduled', scheduleText);
    }

    res.json(match);
  } catch (err) {
    console.error('Schedule match error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Get tournament statistics
exports.getTournamentStats = async (req, res) => {
  try {
    const tournament = await Tournament.findByPk(req.params.id);
    if (!tournament) return res.status(404).json({ msg: 'Tournament not found' });

    const participants = await TournamentParticipant.findAll({
      where: { tournamentId: req.params.id },
    });

    const matches = await Match.findAll({
      where: { tournamentId: req.params.id },
    });

    const totalGoals = participants.reduce((sum, p) => sum + p.goalsFor, 0);
    const finishedMatches = matches.filter(m => m.status === 'finished').length;

    // Top scorer
    const topScorer = participants.reduce((max, p) => 
      p.goalsFor > (max?.goalsFor || 0) ? p : max
    , null);

    // Top team
    const topTeam = participants.reduce((max, p) => 
      p.points > (max?.points || 0) ? p : max
    , null);

    const scheduledMatches = matches.filter((m) => m.status === 'scheduled').length;

    const recentResults = await Match.findAll({
      where: { tournamentId: req.params.id, status: 'finished' },
      include: [
        { model: User, as: 'homeUser', attributes: ['id', 'firstName', 'lastName'] },
        { model: User, as: 'awayUser', attributes: ['id', 'firstName', 'lastName'] },
      ],
      order: [['matchDate', 'DESC']],
      limit: 12,
    });

    let topScorerName = null;
    let topTeamName = null;
    if (topScorer?.userId) {
      const u = await User.findByPk(topScorer.userId, {
        attributes: ['firstName', 'lastName'],
        include: [{ model: Profile, attributes: ['club'] }],
      });
      if (u) {
        topScorerName = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.Profile?.club || null;
      }
    }
    if (topTeam?.userId) {
      const u = await User.findByPk(topTeam.userId, {
        attributes: ['firstName', 'lastName'],
        include: [{ model: Profile, attributes: ['club'] }],
      });
      if (u) {
        topTeamName = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.Profile?.club || null;
      }
    }

    const stats = {
      totalParticipants: participants.length,
      totalMatches: matches.length,
      finishedMatches,
      scheduledMatches,
      totalGoals,
      avgGoalsPerMatch: finishedMatches > 0 ? (totalGoals / finishedMatches).toFixed(2) : 0,
      topScorerId: topScorer?.userId,
      topScorerGoals: topScorer?.goalsFor || 0,
      topScorerName,
      topTeamId: topTeam?.userId,
      topTeamPoints: topTeam?.points || 0,
      topTeamName,
      recentResults: recentResults.map((m) => ({
        id: m.id,
        round: m.round,
        matchDate: m.matchDate,
        scoreHome: m.scoreHome,
        scoreAway: m.scoreAway,
        homeName: m.homeUser ? [m.homeUser.firstName, m.homeUser.lastName].filter(Boolean).join(' ').trim() : '',
        awayName: m.awayUser ? [m.awayUser.firstName, m.awayUser.lastName].filter(Boolean).join(' ').trim() : '',
      })),
    };

    res.json(stats);
  } catch (err) {
    console.error('Get tournament stats error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Leave tournament
exports.leaveTournament = async (req, res) => {
  try {
    const tournament = await Tournament.findByPk(req.params.id);
    if (!tournament) return res.status(404).json({ msg: 'Tournament not found' });
    if (tournament.status !== 'open') {
      return res.status(400).json({ msg: 'Cannot leave ongoing tournament' });
    }

    await TournamentParticipant.destroy({
      where: {
        tournamentId: req.params.id,
        userId: req.user.id,
      },
    });

    res.json({ msg: 'Left tournament' });
  } catch (err) {
    console.error('Leave tournament error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Start tournament and generate matches
exports.startTournamentAndGenerateMatches = async (req, res) => {
  try {
    const tournamentId = req.params.id;
    const tournament = await Tournament.findByPk(tournamentId);
    
    if (!tournament) {
      return res.status(404).json({ msg: 'Tournament not found' });
    }

    if (tournament.creatorId !== req.user.id) {
      return res.status(403).json({ msg: 'Only tournament creator can start it' });
    }

    const startAuth = canManageTournamentMatches(tournament, req.user);
    if (!startAuth.ok) return res.status(startAuth.status).json({ msg: startAuth.msg });

    if (tournament.status !== 'open') {
      return res.status(400).json({ msg: 'Tournament already started or finished' });
    }

    // Get participants
    const participants = await TournamentParticipant.findAll({
      where: { tournamentId },
      include: [{ model: User, attributes: ['id', 'firstName', 'lastName'] }]
    });

    if (participants.length < 2) {
      return res.status(400).json({ msg: 'Need at least 2 participants' });
    }

    // Change tournament status
    tournament.status = 'ongoing';
    await tournament.save();

    const matches = [];
    const participantIds = participants.map(p => p.userId);

    if (tournament.type === 'league') {
      // League: Everyone plays everyone
      for (let i = 0; i < participantIds.length; i++) {
        for (let j = i + 1; j < participantIds.length; j++) {
          matches.push({
            tournamentId,
            homeUserId: participantIds[i],
            awayUserId: participantIds[j],
            status: 'scheduled',
            round: 1,
            matchDate: new Date(Date.now() + (matches.length * 24 * 60 * 60 * 1000)) // Space out by days
          });
        }
      }
    } else if (tournament.type === 'knockout' || tournament.type === 'cup') {
      // Knockout: Bracket style (Round of 16, Quarters, Semis, Final)
      // Shuffle participants for random bracket
      const shuffled = [...participantIds].sort(() => Math.random() - 0.5);
      
      // Round 1: Pair up all participants
      for (let i = 0; i < shuffled.length; i += 2) {
        if (i + 1 < shuffled.length) {
          matches.push({
            tournamentId,
            homeUserId: shuffled[i],
            awayUserId: shuffled[i + 1],
            status: 'scheduled',
            round: 1,
            matchDate: new Date(Date.now() + (Math.floor(i / 2) * 24 * 60 * 60 * 1000))
          });
        }
      }

      // If odd number, one team gets a bye (advances automatically)
      if (shuffled.length % 2 !== 0) {
        // The last team gets a bye - we'll create a "placeholder" match
        console.log(`Team ${shuffled[shuffled.length - 1]} gets a bye to round 2`);
      }
    }

    const createdMatches = await Match.bulkCreate(matches);

    if (tournament.type === 'knockout' || tournament.type === 'cup') {
      for (let i = 0; i < createdMatches.length; i += 1) {
        await Bracket.create({
          tournamentId,
          round: createdMatches[i].round || 1,
          position: i,
          matchId: createdMatches[i].id,
        });
      }
    }

    // Notify all participants
    for (const participant of participants) {
      await notifyTournament(
        participant.userId,
        tournamentId,
        'Tournament Started!',
        `${tournament.name} has started! Check your match schedule.`
      );
    }

    res.json({
      msg: 'Tournament started successfully',
      tournament,
      matchesCreated: createdMatches.length,
      matches: createdMatches
    });
  } catch (err) {
    console.error('Start tournament error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Update match result (affects tournament standings)
exports.updateMatchResultForTournament = async (req, res) => {
  try {
    const { matchId } = req.params;
    const { scoreHome, scoreAway } = req.body;

    const match = await Match.findByPk(matchId, {
      include: [{ model: Tournament }]
    });

    if (!match) {
      return res.status(404).json({ msg: 'Match not found' });
    }

    if (!match.Tournament) {
      return res.status(400).json({ msg: 'Match not part of a tournament' });
    }

    const resultAuth = canFillMatchStats(match.Tournament, req.user, match);
    if (!resultAuth.ok) return res.status(resultAuth.status).json({ msg: resultAuth.msg });

    // Update match scores and status
    match.scoreHome = scoreHome;
    match.scoreAway = scoreAway;
    match.status = 'finished';
    await match.save();

    // Update tournament participant stats (for league type)
    if (match.Tournament.type === 'league') {
      const homeParticipant = await TournamentParticipant.findOne({
        where: { tournamentId: match.tournamentId, userId: match.homeUserId }
      });

      const awayParticipant = await TournamentParticipant.findOne({
        where: { tournamentId: match.tournamentId, userId: match.awayUserId }
      });

      if (homeParticipant && awayParticipant) {
        // Update goals
        homeParticipant.goalsFor += scoreHome;
        homeParticipant.goalsAgainst += scoreAway;
        awayParticipant.goalsFor += scoreAway;
        awayParticipant.goalsAgainst += scoreHome;

        // Update wins/draws/losses and points
        if (scoreHome > scoreAway) {
          homeParticipant.wins += 1;
          homeParticipant.points += 3;
          awayParticipant.losses += 1;
        } else if (scoreAway > scoreHome) {
          awayParticipant.wins += 1;
          awayParticipant.points += 3;
          homeParticipant.losses += 1;
        } else {
          homeParticipant.draws += 1;
          homeParticipant.points += 1;
          awayParticipant.draws += 1;
          awayParticipant.points += 1;
        }

        await homeParticipant.save();
        await awayParticipant.save();
      }
    }

    if (match.Tournament.type === 'knockout' || match.Tournament.type === 'cup') {
      await updateStandings(match);
      await tryAdvanceKnockoutRound(match);
    }

    res.json({
      msg: 'Match result updated',
      match
    });
  } catch (err) {
    console.error('Update match result error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Accept participant (creator only)
exports.acceptParticipant = async (req, res) => {
  try {
    const tournament = await Tournament.findByPk(req.params.id);
    if (!tournament) return res.status(404).json({ msg: 'Tournament not found' });
    if (tournament.creatorId !== req.user.id) {
      return res.status(403).json({ msg: 'Only creator can accept participants' });
    }
    const participant = await TournamentParticipant.findOne({
      where: { tournamentId: req.params.id, userId: req.params.userId },
    });
    if (!participant) return res.status(404).json({ msg: 'Participant not found' });
    participant.status = 'accepted';
    await participant.save();
    res.json({ msg: 'Participant accepted' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Reject participant (creator only)
exports.rejectParticipant = async (req, res) => {
  try {
    const tournament = await Tournament.findByPk(req.params.id);
    if (!tournament) return res.status(404).json({ msg: 'Tournament not found' });
    if (tournament.creatorId !== req.user.id) {
      return res.status(403).json({ msg: 'Only creator can reject participants' });
    }
    const participant = await TournamentParticipant.findOne({
      where: { tournamentId: req.params.id, userId: req.params.userId },
    });
    if (!participant) return res.status(404).json({ msg: 'Participant not found' });
    participant.status = 'rejected';
    await participant.save();
    res.json({ msg: 'Participant rejected' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Remove participant (creator only)
exports.removeParticipant = async (req, res) => {
  try {
    const tournament = await Tournament.findByPk(req.params.id);
    if (!tournament) return res.status(404).json({ msg: 'Tournament not found' });
    if (tournament.creatorId !== req.user.id) {
      return res.status(403).json({ msg: 'Only creator can remove participants' });
    }
    await TournamentParticipant.destroy({
      where: { tournamentId: req.params.id, userId: req.params.userId },
    });
    res.json({ msg: 'Participant removed' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};