'use strict';

const { ageFromDateOnly } = require('./registerValidation');

const PARENT_VERIFICATION_MAX_AGE = 17; // under 18

function resolveAge(user) {
  if (!user) return null;
  if (typeof user.getAge === 'function') {
    const a = user.getAge();
    if (a != null && Number.isFinite(a)) return a;
  }
  if (user.dateOfBirth) return ageFromDateOnly(user.dateOfBirth);
  return null;
}

/** Parent confirmation applies only to minors (< 18). */
function needsParentVerification(user) {
  const age = resolveAge(user);
  return age != null && age <= PARENT_VERIFICATION_MAX_AGE;
}

/**
 * After parent/club flags change, set overall `verified` when requirements are met.
 * - Minors: need parentVerified AND clubVerified
 * - Adults: clubVerified alone is enough
 * Does not clear an existing admin `verified` for adults without club.
 */
function syncOverallVerified(user) {
  if (!user) return user;
  if (needsParentVerification(user)) {
    if (user.parentVerified && user.clubVerified) {
      user.verified = true;
    }
  } else if (user.clubVerified) {
    user.verified = true;
  }
  return user;
}

/** Mark club acceptance verification and sync overall flag. */
async function markClubVerified(user) {
  if (!user) return null;
  user.clubVerified = true;
  user.clubVerifiedAt = new Date();
  syncOverallVerified(user);
  await user.save();
  return user;
}

/** Mark parent confirmation and sync overall flag. */
async function markParentVerified(user) {
  if (!user) return null;
  user.parentVerified = true;
  user.parentVerificationToken = null;
  user.parentVerificationExpire = null;
  syncOverallVerified(user);
  await user.save();
  return user;
}

module.exports = {
  PARENT_VERIFICATION_MAX_AGE,
  resolveAge,
  needsParentVerification,
  syncOverallVerified,
  markClubVerified,
  markParentVerified,
};
