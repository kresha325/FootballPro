const { Op } = require('sequelize');
const User = require('../models/User');
const Profile = require('../models/Profile');
const ClubMember = require('../models/ClubMember');
const TournamentSquadMember = require('../models/TournamentSquadMember');
const { Tournament, TournamentParticipant } = require('../models/Tournament');

function serializeAthleteUser(user) {
  if (!user) return null;
  const j = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
  return {
    id: j.id,
    userId: j.id,
    firstName: j.firstName,
    lastName: j.lastName,
    role: j.role,
    Profile: j.Profile || null,
  };
}

/**
 * For club-only tournaments: move stray athlete TournamentParticipant rows into
 * TournamentSquadMember under their approved club (if that club is in the tournament).
 * Then remove athletes from the standings participant list.
 */
async function demoteAthleteParticipantsOnClubTournament(tournamentId) {
  const tournament = await Tournament.findByPk(tournamentId, {
    attributes: ['id', 'participantType'],
  });
  if (!tournament || (tournament.participantType || 'individual') !== 'club') {
    return { moved: 0, removed: 0 };
  }

  const rows = await TournamentParticipant.findAll({
    where: { tournamentId },
    include: [{ model: User, attributes: ['id', 'role'] }],
  });
  const clubParticipantIds = new Set(
    rows.filter((r) => String(r.User?.role || '').toLowerCase() === 'club').map((r) => r.userId)
  );
  const athleteRows = rows.filter((r) => String(r.User?.role || '').toLowerCase() === 'athlete');

  let moved = 0;
  let removed = 0;
  for (const row of athleteRows) {
    const membership = await ClubMember.findOne({
      where: {
        athleteId: row.userId,
        status: 'approved',
        clubId: { [Op.in]: [...clubParticipantIds] },
      },
    });
    const clubUserId = membership?.clubId || null;
    if (clubUserId && clubParticipantIds.has(clubUserId)) {
      const [, created] = await TournamentSquadMember.findOrCreate({
        where: { tournamentId, athleteUserId: row.userId },
        defaults: { tournamentId, clubUserId, athleteUserId: row.userId },
      });
      if (created) moved += 1;
    }
    await TournamentParticipant.destroy({
      where: { tournamentId, userId: row.userId },
    });
    removed += 1;
  }
  return { moved, removed };
}

async function loadSquadByClub(tournamentId) {
  const squad = await TournamentSquadMember.findAll({
    where: { tournamentId },
    include: [
      {
        model: User,
        as: 'athlete',
        attributes: ['id', 'firstName', 'lastName', 'role'],
        include: [{ model: Profile, attributes: ['profilePhoto', 'club', 'position', 'ageGroup'] }],
      },
    ],
    order: [['id', 'ASC']],
  });

  const byClub = {};
  for (const row of squad) {
    const clubId = row.clubUserId;
    if (!byClub[clubId]) byClub[clubId] = [];
    byClub[clubId].push(serializeAthleteUser(row.athlete));
  }
  return byClub;
}

async function attachSquadToSerializedTournament(serialized) {
  if (!serialized || !serialized.id) return serialized;
  const pt = serialized.participantType || 'individual';
  if (pt !== 'club' && pt !== 'mixed') {
    return { ...serialized, squadByClub: {} };
  }

  if (pt === 'club') {
    await demoteAthleteParticipantsOnClubTournament(serialized.id);
  }

  let participants = serialized.participants || [];
  if (pt === 'club') {
    const refreshed = await Tournament.findByPk(serialized.id, {
      include: [
        {
          model: User,
          as: 'participants',
          attributes: ['id', 'firstName', 'lastName', 'role'],
          through: { attributes: ['points', 'wins', 'draws', 'losses', 'goalsFor', 'goalsAgainst', 'status'] },
          include: [{ model: Profile, attributes: ['profilePhoto', 'club', 'position'] }],
        },
      ],
    });
    if (refreshed) {
      const j = refreshed.toJSON();
      participants = (j.participants || []).map((p) => {
        const through = p.TournamentParticipant || p.tournament_participant || {};
        const userId = Number(through.userId ?? p.userId ?? p.id);
        const {
          TournamentParticipant: _tp,
          tournament_participant: _tp2,
          ...rest
        } = p;
        return {
          ...rest,
          id: userId,
          userId,
          participantStatus: through.status ?? 'accepted',
          points: through.points,
          wins: through.wins,
          draws: through.draws,
          losses: through.losses,
          goalsFor: through.goalsFor,
          goalsAgainst: through.goalsAgainst,
        };
      });
    }
  }

  const squadByClub = await loadSquadByClub(serialized.id);
  participants = (participants || []).map((p) => {
    const uid = p.userId || p.id;
    const athletes = squadByClub[uid] || [];
    return {
      ...p,
      squadCount: athletes.length,
      squadAthletes: athletes,
    };
  });

  return { ...serialized, participants, squadByClub };
}

/**
 * Replace club's nominated athletes for a tournament.
 * Validates athletes are approved ClubMembers of this club.
 */
async function setClubTournamentSquad(tournamentId, clubUserId, athleteIds) {
  const ids = [...new Set((athleteIds || []).map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n) && n > 0))];

  if (ids.length) {
    const memberships = await ClubMember.findAll({
      where: {
        clubId: clubUserId,
        athleteId: { [Op.in]: ids },
        status: 'approved',
      },
    });
    const allowed = new Set(memberships.map((m) => m.athleteId));
    const invalid = ids.filter((id) => !allowed.has(id));
    if (invalid.length) {
      const err = new Error('Disa lojtarë nuk janë anëtarë të aprovuar të klubit.');
      err.status = 400;
      err.invalid = invalid;
      throw err;
    }
  }

  await TournamentSquadMember.destroy({
    where: { tournamentId, clubUserId },
  });

  for (const athleteUserId of ids) {
    const [row, created] = await TournamentSquadMember.findOrCreate({
      where: { tournamentId, athleteUserId },
      defaults: { tournamentId, clubUserId, athleteUserId },
    });
    if (!created && Number(row.clubUserId) !== Number(clubUserId)) {
      row.clubUserId = clubUserId;
      await row.save();
    }
  }

  // Ensure athletes are not standings participants on club tournaments
  const tournament = await Tournament.findByPk(tournamentId, { attributes: ['participantType'] });
  if ((tournament?.participantType || 'individual') === 'club' && ids.length) {
    await TournamentParticipant.destroy({
      where: { tournamentId, userId: { [Op.in]: ids } },
    });
  }

  return loadSquadByClub(tournamentId);
}

module.exports = {
  demoteAthleteParticipantsOnClubTournament,
  loadSquadByClub,
  attachSquadToSerializedTournament,
  setClubTournamentSquad,
  serializeAthleteUser,
};
