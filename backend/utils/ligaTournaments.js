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
 * Ensure a liga has a linked tournament named after the liga.
 */
async function ensureLigaTournament(liga, { category } = {}) {
  if (!liga?.id || !liga.userId) return null;

  const cat = normalizeCategory(category || 'open');
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
    if (tournament.name !== liga.name) {
      tournament.name = liga.name;
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
    name: liga.name,
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
 * Sync an approved club member into matching liga tournaments as accepted participant
 * (for goals/assists registration by the liga — not as a "club" entry).
 */
async function syncClubMemberToLigaTournaments(membership) {
  if (!membership || membership.status !== 'approved') return { synced: 0 };

  const athleteId = membership.athleteId;
  const clubId = membership.clubId;
  const memberCategory = normalizeCategory(
    membership.competitionCategory || membership.teamType || 'open'
  );

  const ligas = await Liga.findAll();
  const relevantLigaIds = ligas.filter((l) => ligaIncludesClub(l, clubId)).map((l) => l.id);
  if (!relevantLigaIds.length) return { synced: 0 };

  const tournaments = await Tournament.findAll({
    where: {
      ligaId: { [Op.in]: relevantLigaIds },
      status: { [Op.in]: ['open', 'ongoing'] },
    },
  });

  let synced = 0;
  for (const t of tournaments) {
    const tCat = normalizeCategory(t.category || 'open');
    const categoryMatch =
      tCat === 'open' ||
      memberCategory === 'open' ||
      tCat === memberCategory ||
      (memberCategory === 'senior' && (tCat === 'open' || tCat === 'senior'));

    if (!categoryMatch) {
      // Remove from non-matching liga tournaments if previously added via sync
      await TournamentParticipant.destroy({
        where: { tournamentId: t.id, userId: athleteId },
      });
      continue;
    }

    const [row, created] = await TournamentParticipant.findOrCreate({
      where: { tournamentId: t.id, userId: athleteId },
      defaults: {
        tournamentId: t.id,
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

module.exports = {
  ALLOWED_CREATOR_ROLES,
  CATEGORY_OPTIONS,
  normalizeCategory,
  ensureLigaTournament,
  syncClubMemberToLigaTournaments,
  syncClubAthletesToLiga,
  removeClubAthletesFromLiga,
  ligaIncludesClub,
  normalizeClubsArray,
  addClubToList,
  removeClubFromList,
};
