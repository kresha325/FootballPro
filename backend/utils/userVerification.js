'use strict';

const { ageFromDateOnly } = require('./registerValidation');

const PARENT_VERIFICATION_MAX_AGE = 17; // under 18
const ATHLETE_ROLE = 'athlete';

function resolveAge(user) {
  if (!user) return null;
  if (typeof user.getAge === 'function') {
    const a = user.getAge();
    if (a != null && Number.isFinite(a)) return a;
  }
  if (user.dateOfBirth) return ageFromDateOnly(user.dateOfBirth);
  return null;
}

function roleOf(user) {
  return String(user?.role || '').toLowerCase();
}

function isAthleteRole(user) {
  return roleOf(user) === ATHLETE_ROLE;
}

/** Parent confirmation applies only to athlete minors (< 18). */
function needsParentVerification(user) {
  if (!isAthleteRole(user)) return false;
  const age = resolveAge(user);
  return age != null && age <= PARENT_VERIFICATION_MAX_AGE;
}

/**
 * Fully verified (blue check):
 * - Athlete minor: club + parent
 * - Athlete adult: club only
 * - Other roles: premium subscription + admin confirmation
 * - Admin role: always
 */
function effectiveVerified(user) {
  if (!user) return false;
  const role = roleOf(user);
  if (role === 'admin') return true;
  if (role === ATHLETE_ROLE) {
    if (needsParentVerification(user)) {
      return Boolean(user.parentVerified && user.clubVerified);
    }
    return Boolean(user.clubVerified);
  }
  return Boolean(user.premium && user.adminVerified);
}

/**
 * Sync DB `verified` to the effective badge state.
 * For non-athletes, `adminVerified` stores admin approval; `verified` is the public badge.
 */
function syncOverallVerified(user) {
  if (!user) return user;
  const role = roleOf(user);

  if (role === ATHLETE_ROLE) {
    user.verified = effectiveVerified(user);
    return user;
  }

  if (role === 'admin') {
    user.verified = true;
    return user;
  }

  user.verified = Boolean(user.premium && user.adminVerified);
  return user;
}

async function markClubVerified(user) {
  if (!user) return null;
  user.clubVerified = true;
  user.clubVerifiedAt = new Date();
  syncOverallVerified(user);
  await user.save();
  return user;
}

/**
 * If athlete is already approved on a club roster but clubVerified was never set
 * (e.g. accepted before this feature), backfill the flag.
 */
async function ensureClubVerifiedFromRoster(user) {
  if (!user || !isAthleteRole(user)) return user;
  if (user.clubVerified) {
    const before = Boolean(user.verified);
    syncOverallVerified(user);
    if (Boolean(user.verified) !== before) {
      await user.save();
    }
    return user;
  }

  try {
    const ClubMember = require('../models/ClubMember');
    const member = await ClubMember.findOne({
      where: { athleteId: user.id, status: 'approved' },
      attributes: ['id'],
    });
    if (member) {
      return markClubVerified(user);
    }
  } catch (err) {
    console.warn('ensureClubVerifiedFromRoster ClubMember:', err?.message || err);
  }

  try {
    const ClubRosterRequest = require('../models/ClubRosterRequest');
    const request = await ClubRosterRequest.findOne({
      where: { athleteId: user.id, status: 'approved' },
      attributes: ['id'],
    });
    if (request) {
      return markClubVerified(user);
    }
  } catch (err) {
    console.warn('ensureClubVerifiedFromRoster roster request:', err?.message || err);
  }

  const before = Boolean(user.verified);
  syncOverallVerified(user);
  if (Boolean(user.verified) !== before) {
    await user.save();
  }
  return user;
}

async function markParentVerified(user) {
  if (!user) return null;
  user.parentVerified = true;
  user.parentVerificationToken = null;
  user.parentVerificationExpire = null;
  syncOverallVerified(user);
  await user.save();
  return user;
}

async function markAdminVerified(user) {
  if (!user) return null;
  user.adminVerified = true;
  syncOverallVerified(user);
  await user.save();
  return user;
}

async function syncAfterPremiumChange(user) {
  if (!user) return null;
  syncOverallVerified(user);
  await user.save();
  return user;
}

module.exports = {
  PARENT_VERIFICATION_MAX_AGE,
  resolveAge,
  roleOf,
  isAthleteRole,
  needsParentVerification,
  effectiveVerified,
  syncOverallVerified,
  markClubVerified,
  ensureClubVerifiedFromRoster,
  markParentVerified,
  markAdminVerified,
  syncAfterPremiumChange,
};
