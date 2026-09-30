const { Op } = require('sequelize');
const Liga = require('../models/Liga');
const { Tournament, TournamentParticipant } = require('../models/Tournament');
const { resolveTournamentSeason } = require('./footballSeason');

const ALLOWED_CREATOR_ROLES = new Set(['liga', 'club', 'scout']);

const CATEGORY_OPTIONS = [
  'open',
  'senior',
  'u23',
  'u21',
  'u19',
  'u17',
  'u15',
  'u13',
  'u11',
  'u10',
  'u9',
];

function normalizeCategory(value) {
  if (!value) return 'open';
  const v = String(value).trim().toLowerCase().replace(/\s+/g, '');
  if (v === 'first_team' || v === 'men') return 'senior';
  if (CATEGORY_OPTIONS.includes(v)) return v;
  if (v.startsWith('u') && /^u\d+$/.test(v)) return v;
  return 'open';
}

function ligaIncludesClub(liga, clubId) {
  const clubs = liga?.clubs;
  // Liga must list the club (user ids / objects) for members to sync into its tournament
  if (!Array.isArray(clubs) || clubs.length === 0) return false;
  const id = String(clubId);
  return clubs.some((c) => {
    if (c == null) return false;
    if (typeof c === 'number' || typeof c === 'string') return String(c) === id;
    return String(c.id || c.userId || c.clubId || '') === id;
  });
}

/**
 * Ensure a liga has a linked tournament for the given category (e.g. open, u15).
 */
async function ensureLigaTournament(liga, { category } = {}) {
  if (!liga?.id || !liga.userId) return null;

  const cat = normalizeCategory(category || 'open');
  const displayName =
    cat === 'open' || cat === 'senior'
      ? liga.name
      : `${liga.name} (${String(cat).toUpperCase()})`;

  let tournament = await Tournament.findOne({
    where: { ligaId: liga.id, category: cat },
  });
  if (!tournament) {
    // Legacy: single liga tournament without matching category row
    tournament = await Tournament.findOne({ where: { ligaId: liga.id } });
    if (tournament && normalizeCategory(tournament.category || 'open') !== cat) {
      tournament = null;
    }
  }

  let season;
  try {
    season = resolveTournamentSeason({ type: 'league', startDate: new Date() });
  } catch {
    const y = new Date().getFullYear();
    season = `${y}/${y + 1}`;
  }

  if (tournament) {
    let dirty = false;
    if (tournament.name !== displayName) {
      tournament.name = displayName;
      dirty = true;
    }
    if (liga.description && tournament.description !== liga.description) {
      tournament.description = liga.description;
      dirty = true;
    }
    if (tournament.category !== cat) {
      tournament.category = cat;
      dirty = true;
    }
    if (!tournament.sourceRole) {
      tournament.sourceRole = 'liga';
      dirty = true;
    }
    if (dirty) await tournament.save();
    return tournament;
  }

  tournament = await Tournament.create({
    name: displayName,
    description: liga.description || `Turneu i ligës ${liga.name}`,
    type: 'league',
    season,
    status: 'open',
    participantType: 'individual',
    maxParticipants: 500,
    creatorId: liga.userId,
    ligaId: liga.id,
    sourceRole: 'liga',
    category: cat,
  });
  return tournament;
}

/**
 * Sync an approved club member into the liga tournament for their competition category.
 * Ensures the category tournament exists (e.g. U15), adds the athlete there, and removes
 * them from other non-matching liga tournaments of the same liga.
 */
async function syncClubMemberToLigaTournaments(membership) {
  if (!membership || membership.status !== 'approved') return { synced: 0 };

  const athleteId = membership.athleteId;
  const clubId = membership.clubId;
  const memberCategory = normalizeCategory(
    membership.competitionCategory || membership.teamType || 'open'
  );

  const ligas = await Liga.findAll();
  const relevantLigas = ligas.filter((l) => ligaIncludesClub(l, clubId));
  if (!relevantLigas.length) return { synced: 0 };

  let synced = 0;

  for (const liga of relevantLigas) {
    // Ensure the liga has a tournament for this exact category (creates U15 etc. if missing).
    const target = await ensureLigaTournament(liga, { category: memberCategory });
    if (!target) continue;

    // Only sync into open/ongoing tournaments.
    if (!['open', 'ongoing'].includes(String(target.status || ''))) {
      continue;
    }

    // Remove athlete from other categories of this liga (keep only the approved band).
    const siblingTournaments = await Tournament.findAll({
      where: {
        ligaId: liga.id,
        id: { [Op.ne]: target.id },
      },
      attributes: ['id', 'category'],
    });
    for (const sibling of siblingTournaments) {
      await TournamentParticipant.destroy({
        where: { tournamentId: sibling.id, userId: athleteId },
      });
    }

    const [row, created] = await TournamentParticipant.findOrCreate({
      where: { tournamentId: target.id, userId: athleteId },
      defaults: {
        tournamentId: target.id,
        userId: athleteId,
        status: 'accepted',
        points: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
      },
    });
    if (!created && row.status !== 'accepted') {
      row.status = 'accepted';
      await row.save();
    }
    synced += 1;
  }

  return { synced };
}

async function syncClubAthletesToLiga(liga, clubId) {
  const ClubMember = require('../models/ClubMember');
  const members = await ClubMember.findAll({
    where: { clubId, status: 'approved' },
  });
  let synced = 0;
  for (const m of members) {
    const r = await syncClubMemberToLigaTournaments(m);
    synced += r.synced || 0;
  }
  return { synced, members: members.length };
}

async function removeAthleteFromClubLigaTournaments(athleteId, clubId) {
  if (!athleteId || !clubId) return { removed: 0 };
  const ligas = await Liga.findAll();
  const relevantLigaIds = ligas.filter((l) => ligaIncludesClub(l, clubId)).map((l) => l.id);
  if (!relevantLigaIds.length) return { removed: 0 };

  const tournaments = await Tournament.findAll({
    where: { ligaId: { [Op.in]: relevantLigaIds } },
    attributes: ['id'],
  });
  const tournamentIds = tournaments.map((t) => t.id);
  if (!tournamentIds.length) return { removed: 0 };

  const removed = await TournamentParticipant.destroy({
    where: {
      tournamentId: { [Op.in]: tournamentIds },
      userId: athleteId,
    },
  });
  return { removed };
}

async function removeClubAthletesFromLiga(liga, clubId) {
  if (!liga?.id) return { removed: 0 };
  const ClubMember = require('../models/ClubMember');
  const members = await ClubMember.findAll({
    where: { clubId, status: 'approved' },
  });
  const athleteIds = members.map((m) => m.athleteId);
  if (!athleteIds.length) return { removed: 0 };

  const tournaments = await Tournament.findAll({
    where: { ligaId: liga.id },
    attributes: ['id'],
  });
  const tournamentIds = tournaments.map((t) => t.id);
  if (!tournamentIds.length) return { removed: 0 };

  const removed = await TournamentParticipant.destroy({
    where: {
      tournamentId: { [Op.in]: tournamentIds },
      userId: { [Op.in]: athleteIds },
    },
  });
  return { removed };
}

function normalizeClubsArray(clubs) {
  if (!Array.isArray(clubs)) return [];
  return clubs.map((c) => {
    if (c == null) return null;
    if (typeof c === 'number' || typeof c === 'string') return Number(c) || c;
    return Number(c.id || c.userId || c.clubId) || c;
  }).filter((c) => c != null && c !== '');
}

function addClubToList(clubs, clubId) {
  const list = normalizeClubsArray(clubs);
  const id = Number(clubId);
  if (list.some((c) => String(c) === String(id) || String(c?.id || c?.userId || '') === String(id))) {
    return { list, added: false };
  }
  list.push(id);
  return { list, added: true };
}

function removeClubFromList(clubs, clubId) {
  const id = String(clubId);
  const list = normalizeClubsArray(clubs).filter((c) => {
    if (typeof c === 'number' || typeof c === 'string') return String(c) !== id;
    return String(c?.id || c?.userId || c?.clubId || '') !== id;
  });
  return list;
}

/** Ligas that list this club userId in Liga.clubs. */
async function findLigasForClub(clubUserId) {
  if (clubUserId == null || clubUserId === '') return [];
  const Liga = require('../models/Liga');
  const ligas = await Liga.findAll({
    attributes: ['id', 'userId', 'name', 'logo', 'level', 'country', 'clubs'],
  });
  return ligas
    .filter((l) => ligaIncludesClub(l, clubUserId))
    .map((l) => {
      const plain = typeof l.get === 'function' ? l.get({ plain: true }) : { ...l };
      return {
        id: plain.userId,
        ligaId: plain.id,
        userId: plain.userId,
        name: plain.name,
        logo: plain.logo || null,
        level: plain.level || null,
        country: plain.country || null,
      };
    });
}

module.exports = {
  ALLOWED_CREATOR_ROLES,
  CATEGORY_OPTIONS,
  normalizeCategory,
  ensureLigaTournament,
  syncClubMemberToLigaTournaments,
  syncClubAthletesToLiga,
  removeClubAthletesFromLiga,
  removeAthleteFromClubLigaTournaments,
  ligaIncludesClub,
  findLigasForClub,
  normalizeClubsArray,
  addClubToList,
  removeClubFromList,
};
