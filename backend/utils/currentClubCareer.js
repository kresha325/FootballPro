const TransferHistory = require('../models/TransferHistory');

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
 * When the athlete has no real transfers yet, register/update a current-club stint
 * ("ClubName · nga YEAR · vazhdon") so Karriera / Transferet are not empty.
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
    // Real transfer history exists — leave transfers alone; player manages them.
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
};
