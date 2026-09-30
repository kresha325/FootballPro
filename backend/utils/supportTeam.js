'use strict';

const sequelize = require('../config/database');
const User = require('../models/User');

/**
 * Resolve the X Talenti support / team inbox user.
 * Set SUPPORT_TEAM_USER_ID (preferred) or SUPPORT_TEAM_EMAIL on the server.
 */
async function resolveSupportTeamUser() {
  const idRaw = String(process.env.SUPPORT_TEAM_USER_ID || '').trim();
  if (idRaw) {
    const id = parseInt(idRaw, 10);
    if (Number.isFinite(id) && id > 0) {
      const byId = await User.findByPk(id, {
        attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
      });
      if (byId) return byId;
    }
  }

  const email = String(process.env.SUPPORT_TEAM_EMAIL || 'support@xtalenti.com')
    .trim()
    .toLowerCase();
  if (email) {
    const byEmail = await User.findOne({
      where: sequelize.where(sequelize.fn('LOWER', sequelize.col('email')), email),
      attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
    });
    if (byEmail) return byEmail;
  }

  const admin = await User.findOne({
    where: { role: 'admin' },
    order: [['id', 'ASC']],
    attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
  });
  return admin || null;
}

function isSupportChatConfiguredSync() {
  // Chat tries SUPPORT_TEAM_* then falls back to first admin user.
  return true;
}

module.exports = {
  resolveSupportTeamUser,
  isSupportChatConfiguredSync,
};
