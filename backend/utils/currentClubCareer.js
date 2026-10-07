const logger = require('./logger');
const TransferHistory = require('../models/TransferHistory');
const Profile = require('../models/Profile');
const User = require('../models/User');
const { Op } = require('sequelize');

/** Marker stored in TransferHistory.notes for auto current-club stints (hidden in UI). */
const CURRENT_CLUB_NOTE = '__current_club__';

function parseClubJoinedYear(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = parseInt(String(raw).replace(/[^\d]/g, ''), 10);
  if (!Number.isFinite(n)) return null;
  const max = new Date().getFullYear() + 1;
  if (n < 1950 || n > max) return null;
  return n;
}

function yearFromTransfer(transferLike) {
  if (!transferLike) return null;
  if (transferLike.transferDate) {
    const d = new Date(transferLike.transferDate);
    if (!Number.isNaN(d.getTime())) return d.getUTCFullYear();
  }
  const seasonMatch = String(transferLike.season || '').match(/(19|20)\d{2}/);
  if (seasonMatch) return parseClubJoinedYear(seasonMatch[0]);
  return null;
}

async function resolveClubUserId({ clubUserId, clubName }) {
  if (clubUserId != null && Number.isFinite(Number(clubUserId)) && Number(clubUserId) > 0) {
    const byId = await User.findByPk(Number(clubUserId));
    if (byId && String(byId.role || '').toLowerCase() === 'club') return byId.id;
  }
  const name = String(clubName || '').trim();
  if (!name) return null;
  const clubByUser = await User.findOne({
    where: {
      role: 'club',
      [Op.or]: [
        { firstName: { [Op.iLike]: `%${name}%` } },
        { lastName: { [Op.iLike]: `%${name}%` } },
      ],
    },
  });
  if (clubByUser) return clubByUser.id;
  const clubProfile = await Profile.findOne({
    where: { club: { [Op.iLike]: `%${name}%` } },
    include: [{ model: User, where: { role: 'club' }, required: true }],
  });
  return clubProfile?.User?.id || clubProfile?.userId || null;
}

function currentClubSeasonLabel(year) {
  return `nga ${year}`;
}

function currentClubCareerEntry(clubName, year) {
  const safeYear = parseClubJoinedYear(year);
  return {
    club: clubName,
    season: safeYear ? `${currentClubSeasonLabel(safeYear)} · vazhdon` : 'vazhdon',
    fromYear: safeYear,
    ongoing: true,
  };
}

function isAutoCareerHistory(careerHistory) {
  if (!Array.isArray(careerHistory) || careerHistory.length === 0) return false;
  if (careerHistory.length === 1) {
    const row = careerHistory[0];
    return Boolean(row && (row.ongoing === true || row.fromYear != null || row.transferId != null));
  }
  // Fully derived from transfers (every row has transferId)
  return careerHistory.every((row) => row && row.transferId != null);
}

/**
 * Build full club timeline from confirmed transfers (newest first).
 * @param {number} userId
 * @param {{ currentJoinedYear?: number|null }} [options]
 */
async function buildCareerHistoryFromTransfers(userId, options = {}) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) return [];

  const preferredCurrentYear = parseClubJoinedYear(options.currentJoinedYear);

  let transfers = [];
  try {
    transfers = await TransferHistory.findAll({
      where: {
        userId: uid,
        [Op.or]: [
          { status: { [Op.notIn]: ['pending', 'rejected', 'cancelled'] } },
          { status: { [Op.is]: null } },
        ],
      },
      order: [
        ['transferDate', 'ASC'],
        ['id', 'ASC'],
      ],
    });
  } catch (err) {
    // status column may be missing before migration
    logger.warn('buildCareerHistoryFromTransfers status filter:', err?.message || err);
    transfers = await TransferHistory.findAll({
      where: { userId: uid },
      order: [
        ['transferDate', 'ASC'],
        ['id', 'ASC'],
      ],
    });
  }

  transfers = transfers.filter((t) => {
    const s = String(t.status || 'confirmed').toLowerCase();
    return !['pending', 'rejected', 'cancelled'].includes(s);
  });

  const real = transfers.filter((t) => t.notes !== CURRENT_CLUB_NOTE);
  const list = real.length ? real : transfers.filter((t) => t.notes === CURRENT_CLUB_NOTE);

  const chronological = [];

  // Seed previous club from the earliest fromClub when it isn't already a toClub
  if (list.length) {
    const first = list[0];
    const fromName = String(first.fromClub || '').trim();
    const firstTo = String(first.toClub || '').trim();
    if (fromName && fromName.toLowerCase() !== firstTo.toLowerCase()) {
      const fromYear = parseClubJoinedYear(yearFromTransfer(first));
      chronological.push({
        club: fromName,
        clubUserId: first.fromClubUserId || null,
        season: fromYear ? String(fromYear) : null,
        fromYear,
        ongoing: false,
        transferId: null,
        position: null,
      });
    }
  }

  for (let i = 0; i < list.length; i += 1) {
    const t = list[i];
    const club = String(t.toClub || '').trim();
    if (!club) continue;
    if (chronological.length && chronological[chronological.length - 1].club === club) {
      continue;
    }
    const year = parseClubJoinedYear(yearFromTransfer(t));
    chronological.push({
      club,
      clubUserId: t.toClubUserId || null,
      season: year ? String(year) : String(t.season || '').replace(/^nga\s+/i, '') || null,
      fromYear: year,
      ongoing: false,
      transferId: t.id,
      position: t.position || null,
    });
  }

  if (chronological.length) {
    const last = chronological[chronological.length - 1];
    last.ongoing = true;
    if (preferredCurrentYear) {
      last.fromYear = preferredCurrentYear;
    }
    last.season = last.fromYear
      ? `${currentClubSeasonLabel(last.fromYear)} · vazhdon`
      : 'vazhdon';

    for (let i = 0; i < chronological.length - 1; i += 1) {
      const row = chronological[i];
      const next = chronological[i + 1];
      if (row.fromYear && next.fromYear && next.fromYear !== row.fromYear) {
        row.season = `${row.fromYear}–${next.fromYear}`;
      } else if (row.fromYear) {
        row.season = String(row.fromYear);
      }
    }
  }

  return chronological.reverse();
}

/**
 * Persist careerHistory from transfers.
 * @param {number} userId
 * @param {object|null} profileLike
 * @param {{ force?: boolean }} [options]
 */
async function syncCareerHistoryFromTransfers(userId, profileLike = null, options = {}) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) return null;

  const profile = profileLike || (await Profile.findOne({ where: { userId: uid } }));
  if (!profile) return null;

  const career = profile.careerHistory;
  const emptyCareer =
    career == null || career === '' || (Array.isArray(career) && career.length === 0);
  if (!options.force && !emptyCareer && !isAutoCareerHistory(career)) return career;

  const entries = await buildCareerHistoryFromTransfers(uid, {
    currentJoinedYear: profile.clubJoinedYear,
  });
  if (!entries.length) return career;

  await profile.update({ careerHistory: entries });
  return entries;
}

/**
 * Keep previous club in history instead of deleting the auto current-club stint.
 */
async function closeCurrentClubAutoStints(userId, { endLabel } = {}) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) return 0;

  const autos = await TransferHistory.findAll({
    where: { userId: uid, notes: CURRENT_CLUB_NOTE },
  });
  if (!autos.length) return 0;

  const end = endLabel || String(new Date().getFullYear());
  for (const row of autos) {
    await row.update({
      notes: null,
      contractUntil: end,
      status: 'confirmed',
      fromClubConfirmedAt: row.fromClubConfirmedAt || new Date(),
      toClubConfirmedAt: row.toClubConfirmedAt || new Date(),
    });
  }
  return autos.length;
}

/**
 * Update the displayed "nga YYYY · vazhdon" year for the current club.
 * Works even when the athlete already has real transfers.
 */
async function applyCurrentClubJoinedYear(userId, year, profileLike = null) {
  const uid = Number(userId);
  const joinedYear = parseClubJoinedYear(year);
  if (!Number.isFinite(uid) || uid <= 0 || !joinedYear) return null;

  const profile = profileLike || (await Profile.findOne({ where: { userId: uid } }));
  if (!profile) return null;

  await profile.update({ clubJoinedYear: joinedYear });

  try {
    const autoStint = await TransferHistory.findOne({
      where: { userId: uid, notes: CURRENT_CLUB_NOTE },
      order: [['id', 'DESC']],
    });
    if (autoStint) {
      await autoStint.update({
        season: currentClubSeasonLabel(joinedYear),
        transferDate: new Date(Date.UTC(joinedYear, 0, 1)),
        contractUntil: 'vazhdon',
        status: 'confirmed',
      });
    }
  } catch (err) {
    logger.warn('applyCurrentClubJoinedYear transfer:', err?.message || err);
  }

  try {
    const career = profile.careerHistory;
    const emptyCareer =
      career == null || career === '' || (Array.isArray(career) && career.length === 0);
    if (emptyCareer || isAutoCareerHistory(career)) {
      await syncCareerHistoryFromTransfers(uid, profile, { force: true });
    } else if (Array.isArray(career) && career.length) {
      const next = career.map((row) => ({ ...row }));
      const ongoingIdx = next.findIndex((r) => r && r.ongoing);
      const idx = ongoingIdx >= 0 ? ongoingIdx : 0;
      if (next[idx]) {
        next[idx] = {
          ...next[idx],
          fromYear: joinedYear,
          season: `${currentClubSeasonLabel(joinedYear)} · vazhdon`,
          ongoing: true,
        };
        await profile.update({ careerHistory: next });
      }
    }
  } catch (err) {
    logger.warn('applyCurrentClubJoinedYear career:', err?.message || err);
  }

  return { clubJoinedYear: joinedYear };
}

/**
 * Set athlete Profile.club / clubId / clubJoinedYear from a transfer destination.
 */
async function syncProfileCurrentClubFromTransfer(userId, transferLike) {
  const uid = Number(userId);
  const toClub = String(transferLike?.toClub || '').trim();
  if (!Number.isFinite(uid) || uid <= 0 || !toClub) return null;

  const profile = await Profile.findOne({ where: { userId: uid } });
  if (!profile) return null;

  const clubId = await resolveClubUserId({
    clubUserId: transferLike.toClubUserId,
    clubName: toClub,
  });
  const joinedYear = parseClubJoinedYear(yearFromTransfer(transferLike));

  const patch = {
    club: toClub,
    clubId: clubId || null,
  };
  if (joinedYear) patch.clubJoinedYear = joinedYear;

  await profile.update(patch);

  try {
    const transferId = transferLike?.id != null ? Number(transferLike.id) : null;
    if (transferId) {
      await TransferHistory.update(
        { contractUntil: null },
        {
          where: {
            userId: uid,
            contractUntil: 'vazhdon',
            id: { [Op.ne]: transferId },
          },
        }
      );
      await TransferHistory.update(
        { contractUntil: 'vazhdon', status: 'confirmed' },
        { where: { id: transferId } }
      );
    }
  } catch (err) {
    logger.warn('syncProfileCurrentClubFromTransfer mark current:', err?.message || err);
  }

  try {
    await syncCareerHistoryFromTransfers(uid, profile, { force: true });
  } catch (err) {
    logger.warn('syncProfileCurrentClubFromTransfer careerHistory:', err?.message || err);
  }

  return patch;
}

/** After delete: set current club from the newest remaining transfer (or clear). */
async function syncProfileCurrentClubFromLatestTransfer(userId) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) return null;

  const latest = await TransferHistory.findOne({
    where: {
      userId: uid,
      status: 'confirmed',
      notes: { [Op.or]: [{ [Op.ne]: CURRENT_CLUB_NOTE }, { [Op.is]: null }] },
    },
    order: [
      ['transferDate', 'DESC'],
      ['id', 'DESC'],
    ],
  });

  if (latest) {
    return syncProfileCurrentClubFromTransfer(uid, latest);
  }

  const auto = await TransferHistory.findOne({
    where: { userId: uid, notes: CURRENT_CLUB_NOTE, status: 'confirmed' },
    order: [['id', 'DESC']],
  });
  if (auto) {
    return syncProfileCurrentClubFromTransfer(uid, auto);
  }

  const profile = await Profile.findOne({ where: { userId: uid } });
  if (profile) {
    await profile.update({ club: '', clubId: null });
  }
  return null;
}

/**
 * When the athlete has no real transfers yet, register/update a current-club stint.
 */
async function syncCurrentClubCareer({
  userId,
  clubName,
  clubUserId,
  year,
  position,
  profile,
}) {
  const trimmedClub = String(clubName || '').trim();
  const joinedYear = parseClubJoinedYear(year);

  if (!trimmedClub || !joinedYear) {
    return { clubJoinedYear: joinedYear };
  }

  const season = currentClubSeasonLabel(joinedYear);
  const transferPayload = {
    transferType: 'player_transfer',
    fromClub: null,
    fromClubUserId: null,
    toClub: trimmedClub,
    toClubUserId: clubUserId ? Number(clubUserId) : null,
    position: position ? String(position).trim() || null : null,
    season,
    transferDate: new Date(Date.UTC(joinedYear, 0, 1)),
    transferFee: null,
    contractUntil: 'vazhdon',
    notes: CURRENT_CLUB_NOTE,
    status: 'confirmed',
    fromClubConfirmedAt: new Date(),
    toClubConfirmedAt: new Date(),
  };

  try {
    const existing = await TransferHistory.findAll({
      where: { userId },
      order: [['id', 'ASC']],
    });
    const autoOnly =
      existing.length === 0 ||
      (existing.length === 1 && existing[0].notes === CURRENT_CLUB_NOTE);

    if (existing.length === 0) {
      await TransferHistory.create({ userId, ...transferPayload });
    } else if (autoOnly) {
      await existing[0].update(transferPayload);
    }
  } catch (err) {
    logger.warn('syncCurrentClubCareer transfer upsert skipped:', err && err.message);
  }

  if (profile) {
    try {
      await syncCareerHistoryFromTransfers(userId, profile, { force: true });
    } catch (err) {
      logger.warn('syncCurrentClubCareer careerHistory update skipped:', err && err.message);
    }
  }

  return { clubJoinedYear: joinedYear };
}

module.exports = {
  CURRENT_CLUB_NOTE,
  parseClubJoinedYear,
  currentClubSeasonLabel,
  currentClubCareerEntry,
  isAutoCareerHistory,
  buildCareerHistoryFromTransfers,
  syncCareerHistoryFromTransfers,
  closeCurrentClubAutoStints,
  applyCurrentClubJoinedYear,
  syncCurrentClubCareer,
  syncProfileCurrentClubFromTransfer,
  syncProfileCurrentClubFromLatestTransfer,
  resolveClubUserId,
};
