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
  return {
    club: clubName,
    season: `${currentClubSeasonLabel(year)} · vazhdon`,
    fromYear: year,
    ongoing: true,
  };
}

function isAutoCareerHistory(careerHistory) {
  if (!Array.isArray(careerHistory) || careerHistory.length !== 1) return false;
  const row = careerHistory[0];
  return Boolean(row && (row.ongoing === true || row.fromYear != null));
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
  const joinedYear = yearFromTransfer(transferLike);

  const patch = {
    club: toClub,
    clubId: clubId || null,
  };
  if (joinedYear) patch.clubJoinedYear = joinedYear;

  await profile.update(patch);

  try {
    const career = profile.careerHistory;
    const emptyCareer =
      career == null ||
      career === '' ||
      (Array.isArray(career) && career.length === 0);
    if (emptyCareer || isAutoCareerHistory(career)) {
      const year = joinedYear || new Date().getFullYear();
      await profile.update({
        careerHistory: [currentClubCareerEntry(toClub, year)],
      });
    }
  } catch (err) {
    console.warn('syncProfileCurrentClubFromTransfer careerHistory:', err?.message || err);
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
    console.warn('syncCurrentClubCareer transfer upsert skipped:', err && err.message);
  }

  if (profile) {
    try {
      const career = profile.careerHistory;
      const emptyCareer =
        career == null ||
        career === '' ||
        (Array.isArray(career) && career.length === 0);
      if (emptyCareer || isAutoCareerHistory(career)) {
        await profile.update({
          careerHistory: [currentClubCareerEntry(trimmedClub, joinedYear)],
        });
      }
    } catch (err) {
      console.warn('syncCurrentClubCareer careerHistory update skipped:', err && err.message);
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
  syncCurrentClubCareer,
  syncProfileCurrentClubFromTransfer,
  syncProfileCurrentClubFromLatestTransfer,
  resolveClubUserId,
};
