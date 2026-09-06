const { Op } = require('sequelize');
const Block = require('../models/Block');

/**
 * User IDs that should be hidden from `userId` (either direction of block).
 */
async function getBlockedPeerIds(userId) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) return [];

  try {
    const rows = await Block.findAll({
      where: {
        [Op.or]: [{ blockerId: uid }, { blockedId: uid }],
      },
      attributes: ['blockerId', 'blockedId'],
    });
    const ids = new Set();
    for (const row of rows) {
      const a = Number(row.blockerId);
      const b = Number(row.blockedId);
      if (a === uid) ids.add(b);
      else if (b === uid) ids.add(a);
    }
    return [...ids];
  } catch (_e) {
    // Table may not exist before migration
    return [];
  }
}

module.exports = { getBlockedPeerIds };
