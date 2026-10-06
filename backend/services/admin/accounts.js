'use strict';

const User = require('../../models/User');
const { isAthleteRole, markClubVerified, syncOverallVerified } = require('../../utils/userVerification');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function loadUser(userId) {
  const user = await User.findByPk(userId);
  if (!user) throw httpError(404, 'User not found');
  return user;
}

async function suspendUser(userId, reason, actorId) {
  const user = await loadUser(userId);
  if (actorId && String(user.id) === String(actorId)) {
    throw httpError(400, 'You cannot suspend your own account');
  }
  user.bannedAt = new Date();
  user.banReason = String(reason || 'Suspended by admin').slice(0, 1000);
  user.verified = false;
  user.pushTokenMobile = null;
  user.pushTokenWeb = null;
  await user.save();
  return user;
}

async function restoreUser(userId) {
  const user = await loadUser(userId);
  user.bannedAt = null;
  user.banReason = null;
  await user.save();
  return user;
}

async function verifyUser(userId) {
  const user = await loadUser(userId);
  if (isAthleteRole(user)) {
    await markClubVerified(user);
  } else {
    user.premium = true;
    syncOverallVerified(user);
    await user.save();
  }
  await user.reload();
  return user;
}

async function unverifyAthlete(userId) {
  const user = await loadUser(userId);
  if (!isAthleteRole(user)) {
    throw httpError(400, 'Verification for this role follows the subscription. Premium is not changed here.');
  }
  user.clubVerified = false;
  user.clubVerifiedAt = null;
  syncOverallVerified(user);
  await user.save();
  return user;
}

async function revokeSessions(userId) {
  const user = await loadUser(userId);
  user.tokenVersion = Number(user.tokenVersion || 0) + 1;
  await user.save();
  return user;
}

module.exports = {
  httpError,
  suspendUser,
  restoreUser,
  verifyUser,
  unverifyAthlete,
  revokeSessions,
};
