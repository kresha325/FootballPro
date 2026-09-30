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
  let clubs = liga?.clubs;
  if (typeof clubs === 'string') {
    try {
      clubs = JSON.parse(clubs);
    } catch {
      clubs = [];
    }
  }
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
    participantType: 'club',
    maxParticipants: 500,
    creatorId: liga.userId,
    ligaId: liga.id,
    sourceRole: 'liga',
    category: cat,
  });
  return tournament;
}

async function upsertAthleteParticipant(tournamentId, athleteId) {
  const tournament = await Tournament.findByPk(tournamentId, {
    attributes: ['id', 'participantType'],
  });
  // Club tournaments: athletes belong on the club squad list, not the points table.
  if (tournament && (tournament.participantType || 'individual') === 'club') {
    return false;
  }
  const [row, created] = await TournamentParticipant.findOrCreate({
    where: { tournamentId, userId: athleteId },
    defaults: {
      tournamentId,
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
  return true;
}

function categoriesMatch(memberCategory, tournamentCategory) {
  const member = normalizeCategory(memberCategory);
  const tCat = normalizeCategory(tournamentCategory || 'open');
  if (member === tCat) return true;
  // Senior athletes count for open senior liga editions.
  if (member === 'senior' && (tCat === 'open' || tCat === 'senior')) return true;
  if (member === 'open' && (tCat === 'open' || tCat === 'senior')) return true;
  return false;
}

/**
 * Sync an approved club member into tournaments for their competition category.
 * Sources:
 * 1) Ligas that list this club → ensure category tournament and join athlete
 * 2) Tournaments the club already joined (as club account) with matching category
 */
async function syncClubMemberToLigaTournaments(membership) {
  if (!membership || membership.status !== 'approved') return { synced: 0 };

  const athleteId = membership.athleteId;
  const clubId = membership.clubId;
  const memberCategory = normalizeCategory(
    membership.competitionCategory || membership.teamType || 'open'
  );

  let synced = 0;
  const joinedTournamentIds = new Set();

  const ligas = await Liga.findAll();
  let relevantLigas = ligas.filter((l) => ligaIncludesClub(l, clubId));

  // Also discover ligas via tournaments the club already joined.
  const clubParticipations = await TournamentParticipant.findAll({
    where: {
      userId: clubId,
      status: { [Op.in]: ['accepted', 'pending'] },
    },
    attributes: ['tournamentId'],
  });
  if (clubParticipations.length) {
    const clubTournamentIds = clubParticipations.map((p) => p.tournamentId).filter(Boolean);
    const clubTournaments = await Tournament.findAll({
      where: { id: { [Op.in]: clubTournamentIds } },
      attributes: ['id', 'ligaId', 'category', 'status', 'sourceRole', 'participantType'],
    });
    const ligaIdsFromTournaments = [
      ...new Set(clubTournaments.map((t) => t.ligaId).filter(Boolean)),
    ];
    if (ligaIdsFromTournaments.length) {
      const extraLigas = ligas.filter((l) => ligaIdsFromTournaments.includes(l.id));
      const seen = new Set(relevantLigas.map((l) => l.id));
      for (const l of extraLigas) {
        if (!seen.has(l.id)) {
          relevantLigas.push(l);
          seen.add(l.id);
        }
      }
    }

    // Directly add athlete only for non-club tournaments the club already joined.
    for (const t of clubTournaments) {
      if (!['open', 'ongoing'].includes(String(t.status || ''))) continue;
      if (!categoriesMatch(memberCategory, t.category)) continue;
      const full = await Tournament.findByPk(t.id, { attributes: ['id', 'participantType', 'status', 'category'] });
      if ((full?.participantType || 'individual') === 'club') {
        // Remove accidental athlete standings rows; club nominates squad separately.
        await TournamentParticipant.destroy({
          where: { tournamentId: t.id, userId: athleteId },
        });
        continue;
      }
      await upsertAthleteParticipant(t.id, athleteId);
      joinedTournamentIds.add(t.id);
      synced += 1;
    }
  }

  for (const liga of relevantLigas) {
    const target = await ensureLigaTournament(liga, { category: memberCategory });
    if (!target) continue;
    if (!['open', 'ongoing'].includes(String(target.status || ''))) continue;

    // New liga editions are club standings — do not place athletes on the table.
    if ((target.participantType || 'individual') === 'club') {
      await TournamentParticipant.destroy({
        where: { tournamentId: target.id, userId: athleteId },
      });
      continue;
    }

    const siblingTournaments = await Tournament.findAll({
      where: {
        ligaId: liga.id,
        id: { [Op.ne]: target.id },
      },
      attributes: ['id', 'category'],
    });
    for (const sibling of siblingTournaments) {
      // Keep rows for tournaments this club explicitly joined if category still matches.
      if (joinedTournamentIds.has(sibling.id) && categoriesMatch(memberCategory, sibling.category)) {
        continue;
      }
      await TournamentParticipant.destroy({
        where: { tournamentId: sibling.id, userId: athleteId },
      });
    }

    await upsertAthleteParticipant(target.id, athleteId);
    joinedTournamentIds.add(target.id);
    synced += 1;
  }

  // Fallback: matching open/ongoing liga-source tournaments by category, even if clubs[] is empty,
  // when the tournament creator is a liga user and the athlete's club profile is linked somehow.
  // Covered above when club joined tournament or liga lists club.

  return { synced };
}

/** Re-run sync for every approved club membership of an athlete (backfill on profile view). */
async function syncAthleteApprovedMemberships(athleteId) {
  const uid = parseInt(athleteId, 10);
  if (!Number.isFinite(uid) || uid <= 0) return { synced: 0, memberships: 0 };
  const ClubMember = require('../models/ClubMember');
  const Profile = require('../models/Profile');
  const members = await ClubMember.findAll({
    where: { athleteId: uid, status: 'approved' },
  });
  let synced = 0;
  for (const m of members) {
    // Soft-link club → liga when clubs[] is empty but city/name clearly match (e.g. Prizren).
    try {
      await softLinkClubToMatchingLigas(m.clubId);
    } catch (linkErr) {
      console.warn('softLinkClubToMatchingLigas:', linkErr && linkErr.message);
    }
    const r = await syncClubMemberToLigaTournaments(m);
    synced += r.synced || 0;
  }
  return { synced, memberships: members.length };
}

/**
 * If a club is not listed on any liga, attach it to ligas whose name/city clearly match
 * the club profile (regional liga use-case), then sync can create category tournaments.
 */
async function softLinkClubToMatchingLigas(clubId) {
  const Profile = require('../models/Profile');
  const clubProfile = await Profile.findOne({ where: { userId: clubId } });
  if (!clubProfile) return { linked: 0 };

  const clubCity = String(clubProfile.city || '').trim().toLowerCase();
  const clubCountry = String(clubProfile.country || '').trim().toLowerCase();
  const clubName = String(clubProfile.club || '').trim().toLowerCase();
  if (!clubCity && !clubCountry && !clubName) return { linked: 0 };

  const ligas = await Liga.findAll();
  let linked = 0;
  for (const liga of ligas) {
    if (ligaIncludesClub(liga, clubId)) continue;
    const ligaName = String(liga.name || '').trim().toLowerCase();
    const ligaCountry = String(liga.country || '').trim().toLowerCase();
    const cityHit = clubCity && ligaName.includes(clubCity);
    const countryHit =
      clubCountry && ligaCountry && clubCountry === ligaCountry && cityHit;
    if (!cityHit && !countryHit) continue;

    const { list, added } = addClubToList(liga.clubs, clubId);
    if (added) {
      liga.clubs = list;
      liga.changed('clubs', true);
      await liga.save();
      linked += 1;
    }
  }
  return { linked };
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
  syncAthleteApprovedMemberships,
  removeClubAthletesFromLiga,
  removeAthleteFromClubLigaTournaments,
  ligaIncludesClub,
  findLigasForClub,
  normalizeClubsArray,
  addClubToList,
  removeClubFromList,
};
