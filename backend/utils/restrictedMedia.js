'use strict';

const User = require('../models/User');
const { isMinorAthlete, requiresParentalAuthorization } = require('./parentalAuthorization');
const { ageFromDateOnly } = require('./registerValidation');

/** Non-public media and media belonging to a minor awaiting authorization must
 * use Cloudinary authenticated delivery. Public adult media remains public. */
async function requiresAuthenticatedDelivery(userId, visibility = 'public') {
  const level = String(visibility || 'public').trim().toLowerCase();
  if (level !== 'public') return true;
  if (!userId) return false;
  const user = await User.findByPk(userId, { attributes: ['id', 'role', 'dateOfBirth', 'parentVerified'] });
  if (!user) return false;
  if (String(user.role || '').toLowerCase() === 'athlete') {
    const age = user.dateOfBirth ? ageFromDateOnly(user.dateOfBirth) : Number.NaN;
    if (!Number.isFinite(age)) return true;
  }
  if (!isMinorAthlete(user)) return false;
  return requiresParentalAuthorization(user);
}

module.exports = { requiresAuthenticatedDelivery };
