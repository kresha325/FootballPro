'use strict';

const logger = require('./logger');

const { Op } = require('sequelize');
const TournamentSquadMember = require('../models/TournamentSquadMember');
const { TournamentParticipant } = require('../models/Tournament');
const { notify } = require('../services/notifications/service');
const { buildMatchNotice } = require('../services/notifications/policy');

/**
 * Notify only parties tied to this match and tournament.
 * Home/away participants plus squad athletes listed for those clubs.
 */
async function notifyMatchParticipants(match, tournament, opts = {}) {
  const tournamentId = Number(match?.tournamentId);
  if (!Number.isFinite(tournamentId) || tournamentId <= 0) return { notified: 0 };

  const homeId = Number(match.homeUserId);
  const awayId = Number(match.awayUserId);
  const sideIds = [homeId, awayId].filter((id) => Number.isFinite(id) && id > 0);
  if (sideIds.length === 0) return { notified: 0 };

  let allowedSideIds = sideIds;
  try {
    const participants = await TournamentParticipant.findAll({
      where: { tournamentId, userId: { [Op.in]: sideIds } },
      attributes: ['userId'],
    });
    const found = participants.map((p) => Number(p.userId)).filter((id) => id > 0);
    if (found.length) allowedSideIds = found;
  } catch (err) {
    logger.warn('notifyMatchParticipants participants:', err?.message || err);
  }

  const recipientIds = new Set(allowedSideIds);
  try {
    const squad = await TournamentSquadMember.findAll({
      where: { tournamentId, clubUserId: { [Op.in]: allowedSideIds } },
      attributes: ['athleteUserId'],
    });
    for (const row of squad) {
      const athleteId = Number(row.athleteUserId);
      if (Number.isFinite(athleteId) && athleteId > 0) recipientIds.add(athleteId);
    }
  } catch (err) {
    logger.warn('notifyMatchParticipants squad:', err?.message || err);
  }

  let notified = 0;
  for (const userId of recipientIds) {
    try {
      const notice = buildMatchNotice({
        match: { ...(typeof match.toJSON === 'function' ? match.toJSON() : match), reminderWindow: opts.reminderWindow },
        tournament,
        userId,
        kind: opts.kind || 'updated',
      });
      if (opts.title) notice.title = opts.title;
      if (opts.message) notice.message = opts.message;
      const row = await notify(notice);
      if (row && !row.duplicate) notified += 1;
    } catch (err) {
      logger.warn('notifyMatchParticipants user', userId, err?.message || err);
    }
  }
  return { notified, tournamentId, recipients: [...recipientIds] };
}

module.exports = {
  notifyMatchParticipants,
};
