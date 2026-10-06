'use strict';

const { Op } = require('sequelize');
const { notify } = require('./service');

let timer = null;

async function remindUpcomingMatches() {
  const Match = require('../../models/Match');
  const tournamentModule = require('../../models/Tournament');
  const Tournament = tournamentModule.Tournament || tournamentModule;
  const now = Date.now();
  const soonStart = new Date(now + 23 * 60 * 60 * 1000);
  const soonEnd = new Date(now + 25 * 60 * 60 * 1000);
  const kickoffStart = new Date(now - 2 * 60 * 1000);
  const kickoffEnd = new Date(now + 15 * 60 * 1000);

  const matches = await Match.findAll({
    where: {
      status: { [Op.in]: ['scheduled', 'upcoming', 'ready'] },
      [Op.or]: [
        { matchDate: { [Op.between]: [soonStart, soonEnd] } },
        { matchDate: { [Op.between]: [kickoffStart, kickoffEnd] } },
      ],
    },
    limit: 80,
  });

  const { notifyMatchParticipants } = require('../../utils/matchNotifications');
  for (const match of matches) {
    const when = new Date(match.matchDate).getTime();
    const window = when - now > 60 * 60 * 1000 ? '24h' : 'start';
    const tournament = match.tournamentId
      ? await Tournament.findByPk(match.tournamentId).catch(() => null)
      : null;
    await notifyMatchParticipants(match, tournament, { kind: 'starting', reminderWindow: window });
  }
}

async function remindFollowUps() {
  const ScoutShortlist = require('../../models/ScoutShortlist');
  const today = new Date().toISOString().slice(0, 10);
  const rows = await ScoutShortlist.findAll({
    where: { followUpDate: today },
    limit: 100,
  });
  for (const row of rows) {
    await notify({
      userId: row.scoutId,
      eventType: 'SCOUT_FOLLOW_UP',
      title: 'Kujtesë skautimi',
      message: 'Ke një follow-up të planifikuar sot për një lojtar në shortlistë.',
      entityType: 'scouting',
      entityId: row.playerId,
      link: '/scouting',
      idempotencyKey: `followup:${row.id}:${today}:user:${row.scoutId}`.slice(0, 191),
    });
  }
}

async function runDueNotifications() {
  try {
    await remindUpcomingMatches();
  } catch (err) {
    console.warn('match reminder scan:', err?.message || err);
  }
  try {
    await remindFollowUps();
  } catch (err) {
    console.warn('follow-up reminder scan:', err?.message || err);
  }
}

function startNotificationScheduler() {
  if (timer || process.env.NODE_ENV === 'test') return;
  timer = setInterval(() => {
    const { runTrackedJob } = require('../admin/jobs');
    runTrackedJob('notification_reminders', runDueNotifications).catch(() => {});
  }, 10 * 60 * 1000);
  if (typeof timer.unref === 'function') timer.unref();
  const boot = setTimeout(() => {
    runDueNotifications().catch(() => {});
  }, 20000);
  if (typeof boot.unref === 'function') boot.unref();
}

module.exports = {
  startNotificationScheduler,
  runDueNotifications,
};
