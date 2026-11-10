'use strict';

const User = require('../models/User');
const { isMinorAthlete, requiresParentalAuthorization } = require('./parentalAuthorization');
const { ageFromDateOnly } = require('./registerValidation');

/** Non-public media and media belonging to a minor awaiting authorization must
 * use Cloudinary authenticated delivery. Public adult media remains public. */
async function requiresAuthenticatedDelivery(userId, visibility = 'public', options = {}) {
  const level = String(visibility || 'public').trim().toLowerCase();
  if (level !== 'public') return true;
  if (!userId) return false;
  const user = await User.findByPk(userId, { attributes: ['id', 'role', 'dateOfBirth', 'parentVerified'] });
  if (!user) return false;
  if (options.kind && ['gallery', 'video'].includes(options.kind)) {
    const Profile = require('../models/Profile');
    const profile = await Profile.findOne({ where: { userId }, attributes: ['privacy'] });
    const privacy = profile?.privacy && typeof profile.privacy === 'object' ? profile.privacy : {};
    if (String(privacy.gallery || 'public').toLowerCase() !== 'public' ||
      (options.kind === 'video' && String(privacy.videos || 'public').toLowerCase() !== 'public')) return true;
  }
  if (String(user.role || '').toLowerCase() === 'athlete') {
    const age = user.dateOfBirth ? ageFromDateOnly(user.dateOfBirth) : Number.NaN;
    if (!Number.isFinite(age)) return true;
  }
  if (!isMinorAthlete(user)) return false;
  return requiresParentalAuthorization(user);
}

module.exports = { requiresAuthenticatedDelivery };
