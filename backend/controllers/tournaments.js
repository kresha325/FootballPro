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
const { canManageTournamentMatches } = require('../utils/matchPermissions');
const {
  resolveLifecycle,
  canTransition,
  isRegistrationOpen,
  validateCompetitionInput,
  assertRegistration,
  slugifyCompetitionName,
  COMPETITION_TYPES,
} = require('../utils/competitionLifecycle');
const competitionService = require('../services/competitionService');
const {
  attachSquadToSerializedTournament,
  setClubTournamentSquad,
  demoteAthleteParticipantsOnClubTournament,
  loadSquadByClub,
  athleteIdsForClubSquad,
  squadLabel,
} = require('../utils/tournamentSquad');
const { normalizeSquadGroup, isYouthCategory } = require('../utils/squadGroup');

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
      squadGroup: through.squadGroup ?? j.squadGroup ?? null,
    };
  });
}

function serializeTournament(tournament) {
  if (!tournament) return tournament;
  const j = tournament && typeof tournament.toJSON === 'function' ? tournament.toJSON() : { ...tournament };
  return {
    ...j,
    lifecycle: resolveLifecycle(j),
    publicPath: j.id ? `/competitions/${j.id}` : null,
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
    if (type && !COMPETITION_TYPES.includes(type)) {
      return res.status(400).json({ msg: 'Invalid competition type.' });
    }
    let ligaId = null;
    let pt = 'individual';
    if (participantType === 'club') pt = 'club';
    else if (participantType === 'mixed') pt = 'mixed';

    const maxN = parseInt(maxParticipants, 10);
    if (!Number.isFinite(maxN) || maxN < 2 || maxN > 500) {
      return res.status(400).json({ msg: 'Numri i pjesëmarrësve duhet të jetë midis 2 dhe 500 (p.sh. 7).' });
    }

    if (role === 'liga') {
      const liga = await Liga.findOne({ where: { userId: req.user.id } });
      if (!liga) {
        return res.status(400).json({ msg: 'Krijoni profilin e ligës së pari.' });
      }
      name = liga.name;
      ligaId = liga.id;

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

    const inputCheck = validateCompetitionInput({
      name,
      type,
      startDate,
      endDate,
      maxParticipants: maxN,
      gender: req.body.gender,
      registrationDeadline: req.body.registrationDeadline,
    });
    if (!inputCheck.ok) return res.status(inputCheck.status).json({ msg: inputCheck.msg });

    const wantsDraft = req.body.lifecycle === 'draft' || req.body.status === 'draft';
    const tournament = await Tournament.create({
      name,
      description,
      type,
      season: resolvedSeason,
      startDate,
      endDate,
      maxParticipants: maxN,
      participantType: pt,
      creatorId: req.user.id,
      ligaId,
      sourceRole: role,
      category,
      logo: req.body.logo || null,
      organizer: req.body.organizer || null,
      country: req.body.country || null,
      city: req.body.city || null,
      gender: req.body.gender || 'open',
      registrationDeadline: req.body.registrationDeadline || null,
      homeAndAway: !!req.body.homeAndAway,
      groupsCount: req.body.groupsCount || null,
      qualifyPerGroup: req.body.qualifyPerGroup || 2,
      lifecycle: wantsDraft ? 'draft' : 'registration',
      status: wantsDraft ? 'draft' : 'open',
    });
    tournament.slug = slugifyCompetitionName(tournament.name, tournament.id);
    await tournament.save();
    res.status(201).json(serializeTournament(tournament));
  } catch (err) {
    console.error('createTournament:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.updateTournament = async (req, res) => {
  try {
    const tournament = await Tournament.findByPk(req.params.id);
    if (!tournament) return res.status(404).json({ msg: 'Tournament not found' });
    if (Number(tournament.creatorId) !== Number(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Vetëm krijuesi mund të ndryshojë turneun.' });
    }
    if (
      (tournament.ligaId || tournament.sourceRole === 'liga') &&
      req.user.role !== 'liga' &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({ msg: 'Vetëm liga mund të ndryshojë këtë turne.' });
    }

    const { description, type, startDate, endDate, maxParticipants, participantType, season, status, category } =
      req.body;

    // Liga tournaments keep the liga name
    if (!(tournament.ligaId || tournament.sourceRole === 'liga')) {
      if (req.body.name != null && String(req.body.name).trim()) {
        tournament.name = String(req.body.name).trim();
      }
    } else if (req.user.role === 'liga') {
      const liga = await Liga.findOne({ where: { userId: req.user.id } });
      if (liga?.name) tournament.name = liga.name;
    }

    if (description !== undefined) tournament.description = description;
    if (type) tournament.type = type;
    if (startDate !== undefined) tournament.startDate = startDate || null;
    if (endDate !== undefined) tournament.endDate = endDate || null;
    if (maxParticipants !== undefined) {
      const maxN = parseInt(maxParticipants, 10);
      if (!Number.isFinite(maxN) || maxN < 2 || maxN > 500) {
        return res.status(400).json({ msg: 'Numri i pjesëmarrësve duhet të jetë midis 2 dhe 500 (p.sh. 7).' });
      }
      tournament.maxParticipants = maxN;
    }
    if (category !== undefined) tournament.category = normalizeCategory(category);
    if (req.body.logo !== undefined) tournament.logo = req.body.logo || null;
    if (req.body.organizer !== undefined) tournament.organizer = req.body.organizer || null;
    if (req.body.country !== undefined) tournament.country = req.body.country || null;
    if (req.body.city !== undefined) tournament.city = req.body.city || null;
    if (req.body.gender) tournament.gender = req.body.gender;
    if (req.body.registrationDeadline !== undefined) tournament.registrationDeadline = req.body.registrationDeadline || null;
    if (req.body.homeAndAway !== undefined) tournament.homeAndAway = !!req.body.homeAndAway;
    if (req.body.groupsCount !== undefined) tournament.groupsCount = req.body.groupsCount || null;
    if (req.body.qualifyPerGroup !== undefined) tournament.qualifyPerGroup = parseInt(req.body.qualifyPerGroup, 10) || 2;

    const requestedLifecycle = req.body.lifecycle || status;
    if (requestedLifecycle && requestedLifecycle !== tournament.status && requestedLifecycle !== tournament.lifecycle) {
      const next = canTransition(resolveLifecycle(tournament), requestedLifecycle);
      if (!next.ok) return res.status(next.status).json({ msg: next.msg });
      if (next.lifecycle === 'active' || next.lifecycle === 'in_progress' || next.lifecycle === 'completed') {
        return res.status(400).json({ msg: 'Use start, results, and completion actions instead of setting this status directly.' });
      }
      tournament.lifecycle = next.lifecycle;
      tournament.status = next.status;
    }

    if (participantType && ['individual', 'club', 'mixed'].includes(participantType)) {
      tournament.participantType = participantType;
    }

    if (season !== undefined || type || startDate !== undefined) {
      try {
        tournament.season = resolveTournamentSeason({
          type: tournament.type,
          startDate: tournament.startDate,
          season: season !== undefined ? season : tournament.season,
        });
      } catch (seasonErr) {
        return res.status(400).json({ msg: seasonErr.message });
      }
    }

    const inputDates = validateCompetitionInput({
      name: tournament.name,
      type: tournament.type,
      startDate: tournament.startDate,
      endDate: tournament.endDate,
      registrationDeadline: tournament.registrationDeadline,
      gender: tournament.gender,
      maxParticipants: tournament.maxParticipants,
    });
    if (!inputDates.ok) return res.status(inputDates.status).json({ msg: inputDates.msg });

    await tournament.save();
    res.json(serializeTournament(tournament));
  } catch (err) {
    console.error('updateTournament:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getTournaments = async (req, res) => {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.lifecycle) where.lifecycle = req.query.lifecycle;
    if (req.query.type) where.type = req.query.type;
    if (req.query.season) where.season = req.query.season;
    if (req.query.country) where.country = req.query.country;
    const tournaments = await Tournament.findAll({
      where,
      include: [
        { model: User, as: 'creator', attributes: ['id', 'firstName', 'lastName'] },
        { model: User, as: 'participants', attributes: ['id', 'firstName', 'lastName', 'role'], through: { attributes: [] } },
      ],
      order: [['createdAt', 'DESC']],
    });
    const serialized = tournaments.map(serializeTournament);
    const page = parseInt(req.query.page, 10);
    if (Number.isFinite(page) && page > 0) {
      const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);
      const start = (page - 1) * pageSize;
      return res.json({
        rows: serialized.slice(start, start + pageSize),
        total: serialized.length,
        page,
        pageSize,
      });
    }
    res.json(serialized);
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
        { model: User, as: 'creator', attributes: ['id', 'firstName', 'lastName'] },
        {
          model: User,
          as: 'participants',
          attributes: ['id', 'firstName', 'lastName', 'role'],
          through: { attributes: ['points', 'wins', 'draws', 'losses', 'goalsFor', 'goalsAgainst', 'status', 'squadGroup'] },
          include: [{ model: Profile, attributes: ['profilePhoto', 'club', 'position'] }],
        },
        { model: Match, include: [{ model: User, as: 'homeUser' }, { model: User, as: 'awayUser' }] },
      ],
    });
    if (!tournament) return res.status(404).json({ msg: 'Tournament not found' });

    // Auto-accept stuck pending joins (no approval gate in UI for open tournaments)
    const [acceptedCount] = await TournamentParticipant.update(
      { status: 'accepted' },
      { where: { tournamentId: tournament.id, status: 'pending' } }
    );
    if (acceptedCount > 0) {
      const refreshed = await Tournament.findByPk(req.params.id, {
        include: [
          { model: User, as: 'creator', attributes: ['id', 'firstName', 'lastName'] },
          {
            model: User,
            as: 'participants',
            attributes: ['id', 'firstName', 'lastName', 'role'],
            through: { attributes: ['points', 'wins', 'draws', 'losses', 'goalsFor', 'goalsAgainst', 'status', 'squadGroup'] },
            include: [{ model: Profile, attributes: ['profilePhoto', 'club', 'position'] }],
          },
          { model: Match, include: [{ model: User, as: 'homeUser' }, { model: User, as: 'awayUser' }] },
        ],
      });
      return res.json(await attachSquadToSerializedTournament(serializeTournament(refreshed)));
    }

    res.json(await attachSquadToSerializedTournament(serializeTournament(tournament)));
  } catch (err) {
    console.error('getTournament:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.joinTournament = async (req, res) => {
  try {
    const tournament = await Tournament.findByPk(req.params.id);
    if (!tournament) return res.status(404).json({ msg: 'Tournament not found' });
    if (!isRegistrationOpen(tournament)) return res.status(400).json({ msg: 'Tournament not open for joining' });

    const participantType = tournament.participantType || 'individual';
    const isLigaTournament = !!(tournament.ligaId || tournament.sourceRole === 'liga');

    if (req.user.role === 'athlete' && isLigaTournament) {
      return res.status(400).json({
        msg: 'Atletët nuk bashkohen drejtpërdrejt në turnet e ligës — pjesëmarrja bëhet përmes klubit (skuadra e turneut).',
      });
    }
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
    // Count only standings participants (clubs for club tournaments)
    let standingCount = participants.length;
    if (participantType === 'club') {
      const users = await User.findAll({
        where: { id: { [Op.in]: participants.map((p) => p.userId) } },
        attributes: ['id', 'role'],
      });
      const clubIds = new Set(users.filter((u) => u.role === 'club').map((u) => u.id));
      standingCount = participants.filter((p) => clubIds.has(p.userId)).length;
    }
    if (standingCount >= tournament.maxParticipants) return res.status(400).json({ msg: 'Tournament full' });

    const registration = assertRegistration({
      existingUserIds: participants.map((p) => p.userId),
      userId: req.user.id,
      maxParticipants: standingCount < tournament.maxParticipants ? participants.length + 1 : participants.length,
      tournament,
    });
    if (!registration.ok) return res.status(registration.status).json({ msg: registration.msg });

    const category = String(tournament.category || 'open').trim().toLowerCase();
    const youthSquad = req.user.role === 'club' && isYouthCategory(category);
    const squadGroup = normalizeSquadGroup(req.body?.squadGroup);
    if (youthSquad && !squadGroup) {
      return res.status(400).json({
        msg: `Zgjidh grupin A, B ose C për ${String(tournament.category).toUpperCase()}.`,
      });
    }

    await TournamentParticipant.create({
      tournamentId: req.params.id,
      userId: req.user.id,
      status: 'accepted',
      squadGroup: youthSquad ? squadGroup : null,
    });

    // Club may nominate athletes for this tournament on join.
    // Youth bands use the roster group (U13/A) so the squad is not a free pick.
    let squadByClub = {};
    if (req.user.role === 'club' && (participantType === 'club' || participantType === 'mixed')) {
      let athleteIds = Array.isArray(req.body?.athleteIds) ? req.body.athleteIds : [];
      if (youthSquad) {
        athleteIds = await athleteIdsForClubSquad(req.user.id, category, squadGroup);
        if (!athleteIds.length) {
          await TournamentParticipant.destroy({
            where: { tournamentId: req.params.id, userId: req.user.id },
          });
          return res.status(400).json({
            msg: `Nuk ka atletë të aprovuar në ${squadLabel(category, squadGroup)}. Caktoji te skuadra e klubit, pastaj bashkohu.`,
          });
        }
      }
      if (athleteIds.length) {
        squadByClub = await setClubTournamentSquad(tournament.id, req.user.id, athleteIds);
      }
    }

    if (participantType === 'club') {
      await demoteAthleteParticipantsOnClubTournament(tournament.id);
    }

    res.json({
      msg: 'Joined tournament',
      squadAthletes: squadByClub[req.user.id] || [],
    });
  } catch (err) {
    console.error('joinTournament:', err);
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ msg: 'Already joined this tournament' });
    }
    if (err.status === 400) return res.status(400).json({ msg: err.message, invalid: err.invalid });
    res.status(500).json({ msg: 'Server error' });
  }
};

/** Club sets / updates nominated athletes for a tournament (not standings rows). */
exports.setTournamentSquad = async (req, res) => {
  try {
    const tournament = await Tournament.findByPk(req.params.id);
    if (!tournament) return res.status(404).json({ msg: 'Tournament not found' });
    const pt = tournament.participantType || 'individual';
    if (pt !== 'club' && pt !== 'mixed') {
      return res.status(400).json({ msg: 'Skuadra e lojtarëve vlen vetëm për turne klubi ose mixed.' });
    }
    if (req.user.role !== 'club') {
      return res.status(403).json({ msg: 'Vetëm klubi mund të caktojë lojtarët e skuadrës.' });
    }

    const clubJoined = await TournamentParticipant.findOne({
      where: { tournamentId: tournament.id, userId: req.user.id },
    });
    if (!clubJoined) {
      return res.status(400).json({ msg: 'Bashkohuni në turne para se të caktoni lojtarët.' });
    }

    const category = String(tournament.category || 'open').trim().toLowerCase();
    const youthSquad = isYouthCategory(category);
    let athleteIds = Array.isArray(req.body?.athleteIds) ? req.body.athleteIds : [];
    let squadGroup = normalizeSquadGroup(req.body?.squadGroup);
    if (!squadGroup && youthSquad) {
      const current = await TournamentParticipant.findOne({
        where: { tournamentId: tournament.id, userId: req.user.id },
        attributes: ['squadGroup'],
      });
      squadGroup = normalizeSquadGroup(current?.squadGroup);
    }
    if (youthSquad) {
      if (!squadGroup) {
        return res.status(400).json({ msg: 'Zgjidh grupin A, B ose C për këtë grupmoshë.' });
      }
      athleteIds = await athleteIdsForClubSquad(req.user.id, category, squadGroup);
      if (!athleteIds.length) {
        return res.status(400).json({
          msg: `Nuk ka atletë të aprovuar në ${squadLabel(category, squadGroup)}.`,
        });
      }
      await TournamentParticipant.update(
        { squadGroup },
        { where: { tournamentId: tournament.id, userId: req.user.id } }
      );
    }
    const squadByClub = await setClubTournamentSquad(tournament.id, req.user.id, athleteIds);
    res.json({
      msg: 'Skuadra e turneut u përditësua',
      squadAthletes: squadByClub[req.user.id] || [],
      squadByClub,
    });
  } catch (err) {
    console.error('setTournamentSquad:', err);
    if (err.status === 400) return res.status(400).json({ msg: err.message, invalid: err.invalid });
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getTournamentSquad = async (req, res) => {
  try {
    const tournament = await Tournament.findByPk(req.params.id, { attributes: ['id', 'participantType'] });
    if (!tournament) return res.status(404).json({ msg: 'Tournament not found' });
    if ((tournament.participantType || 'individual') === 'club') {
      await demoteAthleteParticipantsOnClubTournament(tournament.id);
    }
    const clubUserId = req.query.clubUserId ? parseInt(req.query.clubUserId, 10) : null;
    const squadByClub = await loadSquadByClub(tournament.id);
    if (Number.isFinite(clubUserId) && clubUserId > 0) {
      return res.json({ clubUserId, athletes: squadByClub[clubUserId] || [] });
    }
    res.json({ squadByClub });
  } catch (err) {
    console.error('getTournamentSquad:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getStandings = async (req, res) => {
  try {
    const payload = await competitionService.getStandings(req.params.id);
    if (!payload) return res.status(404).json({ msg: 'Tournament not found' });
    return res.json(payload);
  } catch (err) {
    console.error('getStandings:', err);
    return res.status(err.status || 500).json({ msg: err.message || 'Server error' });
  }
};

exports.getLeaderboard = async (req, res) => {
  try {
    const payload = await competitionService.getStandings(req.params.id);
    if (!payload) return res.status(404).json({ msg: 'Tournament not found' });
    res.json(payload.rows || []);
  } catch (err) {
    console.error('Get leaderboard error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Generate bracket for knockout tournament
exports.generateBracket = async (req, res) => {
  try {
    const result = await competitionService.startCompetition({
      tournamentId: req.params.id,
      user: req.user,
      options: req.body || {},
    });
    res.json({ msg: 'Bracket generated', ...result });
  } catch (err) {
    console.error('Generate bracket error:', err);
    res.status(err.status || 500).json({ msg: err.message || 'Server error' });
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
    const finishing = req.body?.status === 'finished' || (req.body?.status == null && req.body?.scoreHome != null && req.body?.scoreAway != null && req.body?.live !== true);
    const result = finishing
      ? await competitionService.recordOfficialResult({ matchId, user: req.user, payload: req.body || {} })
      : await competitionService.updateLiveMatch({ matchId, user: req.user, payload: req.body || {} });
    try {
      const { notifyMatchParticipants } = require('../utils/matchNotifications');
      await notifyMatchParticipants(result.match, result.tournament, { kind: 'stats' });
    } catch (notifyErr) {
      console.warn('tournament updateMatchScore notify:', notifyErr?.message || notifyErr);
    }
    res.json(result.match);
  } catch (err) {
    console.error('Update match score error:', err);
    res.status(err.status || 500).json({ msg: err.message || 'Server error' });
  }
};

async function recomputeTournamentStandings(tournamentId) {
  return competitionService.recomputeTournamentStandings(tournamentId);
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
          attributes: ['id', 'name', 'type', 'status', 'participantType', 'creatorId', 'ligaId', 'sourceRole'],
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

    try {
      competitionService.assertScheduledDate(match.Tournament, matchDate);
    } catch (guardErr) {
      return res.status(guardErr.status || 400).json({ msg: guardErr.message });
    }

    await match.update({ matchDate });

    try {
      const { notifyMatchParticipants } = require('../utils/matchNotifications');
      await notifyMatchParticipants(match, match.Tournament, { kind: 'updated' });
    } catch (notifyErr) {
      console.warn('scheduleMatch notify:', notifyErr?.message || notifyErr);
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

    const matches = await Match.findAll({
      where: { tournamentId: req.params.id },
    });

    const finished = matches.filter((m) => m.status === 'finished' && m.scoreHome != null && m.scoreAway != null);
    const finishedMatches = finished.length;
    const scheduledMatches = matches.filter((m) => m.status === 'scheduled').length;

    const totalGoals = finished.reduce(
      (sum, m) => sum + (Number(m.scoreHome) || 0) + (Number(m.scoreAway) || 0),
      0
    );

    // Heal stored participant stats, then use them for summary leaders
    await recomputeTournamentStandings(tournament.id);
    const refreshed = await TournamentParticipant.findAll({
      where: { tournamentId: req.params.id },
    });

    // Top scorer (goals for from standings / matches GF)
    const topScorer = refreshed.reduce(
      (max, p) => (Number(p.goalsFor) > (Number(max?.goalsFor) || 0) ? p : max),
      null
    );

    // Top team by points
    const topTeam = refreshed.reduce(
      (max, p) => (Number(p.points) > (Number(max?.points) || 0) ? p : max),
      null
    );

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
      totalParticipants: refreshed.length,
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
    if (!isRegistrationOpen(tournament)) {
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
    const result = await competitionService.startCompetition({
      tournamentId: req.params.id,
      user: req.user,
      options: req.body || {},
    });
    res.json(result);
  } catch (err) {
    console.error('Start tournament error:', err);
    res.status(err.status || 500).json({ msg: err.message || 'Server error' });
  }
};

// Update match result (affects tournament standings)
exports.updateMatchResultForTournament = async (req, res) => {
  try {
    const result = await competitionService.recordOfficialResult({
      matchId: req.params.matchId,
      user: req.user,
      payload: req.body || {},
    });
    try {
      const { notifyMatchParticipants } = require('../utils/matchNotifications');
      await notifyMatchParticipants(result.match, result.tournament, { kind: 'stats' });
    } catch (notifyErr) {
      console.warn('updateMatchResultForTournament notify:', notifyErr?.message || notifyErr);
    }
    res.json({ msg: 'Match result updated', match: result.match, advancement: result.advancement });
  } catch (err) {
    console.error('Update match result error:', err);
    res.status(err.status || 500).json({ msg: err.message || 'Server error' });
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

exports.getCompetitionPlayerStats = async (req, res) => {
  try {
    const payload = await competitionService.playerStatsForCompetition(req.params.id);
    if (!payload) return res.status(404).json({ msg: 'Tournament not found' });
    res.json(payload);
  } catch (err) {
    console.error('getCompetitionPlayerStats:', err);
    res.status(err.status || 500).json({ msg: err.message || 'Server error' });
  }
};

exports.setTournamentMatchLineup = async (req, res) => {
  try {
    const match = await competitionService.setMatchLineup({
      matchId: req.params.matchId,
      user: req.user,
      lineup: req.body || {},
    });
    res.json({ lineup: match.lineup });
  } catch (err) {
    console.error('setTournamentMatchLineup:', err);
    res.status(err.status || 500).json({ msg: err.message || 'Server error' });
  }
};

exports.addTournamentMatchEvent = async (req, res) => {
  try {
    const event = await competitionService.addMatchEvent({
      matchId: req.params.matchId,
      user: req.user,
      event: req.body || {},
    });
    res.status(201).json(event);
  } catch (err) {
    console.error('addTournamentMatchEvent:', err);
    res.status(err.status || 500).json({ msg: err.message || 'Server error' });
  }
};

exports.saveTournamentPlayerStats = async (req, res) => {
  try {
    const rows = await competitionService.savePlayerStats({
      matchId: req.params.matchId,
      user: req.user,
      players: req.body?.players || req.body,
    });
    res.json({ players: rows });
  } catch (err) {
    console.error('saveTournamentPlayerStats:', err);
    res.status(err.status || 500).json({ msg: err.message || 'Server error' });
  }
};

exports.transitionCompetition = async (req, res) => {
  try {
    const tournament = await competitionService.applyLifecycle({
      tournamentId: req.params.id,
      user: req.user,
      lifecycle: req.body?.lifecycle || req.body?.status,
    });
    res.json(serializeTournament(tournament));
  } catch (err) {
    console.error('transitionCompetition:', err);
    res.status(err.status || 500).json({ msg: err.message || 'Server error' });
  }
};
