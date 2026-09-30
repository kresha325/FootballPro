'use strict';

const { Op } = require('sequelize');
const TournamentSquadMember = require('../models/TournamentSquadMember');
const { TournamentParticipant } = require('../models/Tournament');

/**
 * Notify ONLY parties tied to this match + this tournament:
 * - home/away if they are TournamentParticipants of this tournament
 * - squad athletes listed for those clubs in THIS tournament only
 * Never broadcasts to all clubs/athletes on the platform.
 *
 * @param {object} match
 * @param {object} tournament
 * @param {{ title?: string, message?: string, kind?: 'created'|'updated'|'stats' }} [opts]
 */
async function notifyMatchParticipants(match, tournament, opts = {}) {
  const tournamentId = Number(match?.tournamentId);
  if (!Number.isFinite(tournamentId) || tournamentId <= 0) return { notified: 0 };

  const { notifyTournament } = require('../controllers/notifications');

  const dateLabel = match.matchDate
    ? new Date(match.matchDate).toLocaleString('sq-AL', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'datë e caktuar';
  const tournamentName = tournament?.name || `Turneu #${tournamentId}`;

  const kind = opts.kind || 'updated';
  let notifTitle = opts.title;
  let message = opts.message;

  if (!notifTitle || !message) {
    if (kind === 'created') {
      notifTitle = notifTitle || 'Ndeshje e planifikuar';
      message =
        message ||
        `Në turneun «${tournamentName}» u planifikua një ndeshje për ${dateLabel}. Hap turneun te «Turnet e mia».`;
    } else if (kind === 'stats') {
      const sh = match.scoreHome != null ? Number(match.scoreHome) : null;
      const sa = match.scoreAway != null ? Number(match.scoreAway) : null;
      const scorePart =
        sh != null && sa != null && !Number.isNaN(sh) && !Number.isNaN(sa)
          ? ` Rezultati: ${sh}–${sa}.`
          : '';
      notifTitle = notifTitle || 'Statistikat e ndeshjes';
      message =
        message ||
        `Në turneun «${tournamentName}» u përditësuan statistikat/rezultati i ndeshjes.${scorePart} Hap turneun te «Turnet e mia».`;
    } else {
      notifTitle = notifTitle || 'Ndeshje e përditësuar';
      message =
        message ||
        `Në turneun «${tournamentName}» u ndryshua ndeshja (orar/detaje): ${dateLabel}. Hap turneun te «Turnet e mia».`;
    }
  }

  const homeId = Number(match.homeUserId);
  const awayId = Number(match.awayUserId);
  const sideIds = [homeId, awayId].filter((id) => Number.isFinite(id) && id > 0);

  if (sideIds.length === 0) return { notified: 0 };

  // Only home/away that actually belong to THIS tournament
  let allowedSideIds = sideIds;
  try {
    const participants = await TournamentParticipant.findAll({
      where: {
        tournamentId,
        userId: { [Op.in]: sideIds },
      },
      attributes: ['userId'],
    });
    allowedSideIds = participants.map((p) => Number(p.userId)).filter((id) => id > 0);
  } catch (err) {
    console.warn('notifyMatchParticipants participants:', err?.message || err);
  }

  if (allowedSideIds.length === 0) {
    // Fallback: still notify the match sides (legacy rows without participant row)
    allowedSideIds = sideIds;
  }

  const recipientIds = new Set(allowedSideIds);

  // Athletes on the club squad for THIS tournament only (not whole club roster)
  try {
    const squad = await TournamentSquadMember.findAll({
      where: {
        tournamentId,
        clubUserId: { [Op.in]: allowedSideIds },
      },
      attributes: ['athleteUserId', 'clubUserId'],
    });
    for (const row of squad) {
      const athleteId = Number(row.athleteUserId);
      if (Number.isFinite(athleteId) && athleteId > 0) recipientIds.add(athleteId);
    }
  } catch (err) {
    console.warn('notifyMatchParticipants squad:', err?.message || err);
  }

  let notified = 0;
  for (const userId of recipientIds) {
    try {
      await notifyTournament(userId, tournamentId, notifTitle, message);
      notified += 1;
    } catch (err) {
      console.warn('notifyMatchParticipants user', userId, err?.message || err);
    }
  }
  return { notified, tournamentId, recipients: [...recipientIds] };
}

module.exports = {
  notifyMatchParticipants,
};
