'use strict';

const logger = require('./logger');

/**
 * Plan access for X TALENTI:
 * - free: social features only (after trial)
 * - basic: analytics, verified (non-athlete), highlights ≤10  (+ Free 30-day trial)
 * - pro: scout recommendations, unlimited live, premium streams, themes,
 *        early access labs, priority support
 *
 * Sources: paid premium flag, sponsor subscriptionPlan, first-30-days trial.
 */

const TRIAL_DAYS = 30;
const HIGHLIGHT_LIMIT_BASIC = 10;
const TIER_RANK = { free: 0, basic: 1, pro: 2 };

function msDays(days) {
  return days * 24 * 60 * 60 * 1000;
}

function isProActive(user, now = new Date()) {
  if (!user) return false;
  const plan = String(user.subscriptionPlan || 'free').toLowerCase();
  if (plan === 'premium' || plan === 'pro') {
    if (!user.premiumExpiresAt) return true;
    return new Date(user.premiumExpiresAt) > now;
  }
  if (user.premium) {
    if (!user.premiumExpiresAt) return true;
    return new Date(user.premiumExpiresAt) > now;
  }
  return false;
}

function isBasicSponsor(user) {
  return String(user?.subscriptionPlan || '').toLowerCase() === 'basic';
}

function getTrialEndsAt(user) {
  if (!user?.createdAt) return null;
  return new Date(new Date(user.createdAt).getTime() + msDays(TRIAL_DAYS));
}

function isInFreeTrial(user, now = new Date()) {
  if (!user) return false;
  if (isProActive(user, now) || isBasicSponsor(user)) return false;
  const ends = getTrialEndsAt(user);
  return ends ? ends > now : false;
}

/**
 * @returns {'free'|'basic'|'pro'}
 */
function getEffectiveTier(user, now = new Date()) {
  if (!user) return 'free';
  if (String(user.role || '').toLowerCase() === 'admin') return 'pro';
  if (isProActive(user, now)) return 'pro';
  if (isBasicSponsor(user)) return 'basic';
  if (isInFreeTrial(user, now)) return 'basic';
  return 'free';
}

function hasTier(user, minTier = 'basic', now = new Date()) {
  const effective = getEffectiveTier(user, now);
  return TIER_RANK[effective] >= TIER_RANK[minTier];
}

function buildAccessPayload(user, now = new Date()) {
  const tier = getEffectiveTier(user, now);
  const trialEndsAt = getTrialEndsAt(user);
  const inTrial = isInFreeTrial(user, now);
  return {
    effectiveTier: tier,
    subscriptionPlan: user?.subscriptionPlan || 'free',
    premium: isProActive(user, now),
    premiumExpiresAt: user?.premiumExpiresAt || null,
    trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : null,
    inTrial,
    features: {
      analytics: hasTier(user, 'basic', now),
      verifiedBadgeEligible: hasTier(user, 'basic', now),
      highlights: hasTier(user, 'basic', now),
      highlightLimit: tier === 'pro' ? null : tier === 'basic' ? HIGHLIGHT_LIMIT_BASIC : 0,
      scoutRecommendations: hasTier(user, 'pro', now),
      liveUnlimited: hasTier(user, 'pro', now),
      profileThemes: hasTier(user, 'pro', now),
      earlyAccess: hasTier(user, 'pro', now),
      prioritySupport: hasTier(user, 'pro', now),
    },
  };
}

/**
 * Clear expired Pro flags on the user instance (does not always save).
 * @returns {{ changed: boolean, user: object }}
 */
function reconcileExpiredAccess(user, now = new Date()) {
  if (!user) return { changed: false, user };
  let changed = false;

  if (user.premium && user.premiumExpiresAt && new Date(user.premiumExpiresAt) <= now) {
    user.premium = false;
    changed = true;
  }

  const plan = String(user.subscriptionPlan || 'free').toLowerCase();
  if (
    (plan === 'premium' || plan === 'pro') &&
    user.premiumExpiresAt &&
    new Date(user.premiumExpiresAt) <= now
  ) {
    user.subscriptionPlan = 'free';
    changed = true;
  }

  return { changed, user };
}

async function persistReconcileIfNeeded(user) {
  const { changed } = reconcileExpiredAccess(user);
  if (changed && typeof user.save === 'function') {
    try {
      await user.save();
    } catch (err) {
      logger.warn('reconcileExpiredAccess save:', err?.message || err);
    }
  }
  return user;
}

/** Express middleware: require minimum tier. */
function requireTier(minTier = 'basic') {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ msg: 'Autorizimi u refuzua', code: 'AUTH_REQUIRED' });
    }
    if (hasTier(req.user, minTier)) return next();
    return res.status(403).json({
      msg:
        minTier === 'pro'
          ? 'Kjo veçori kërkon planin Pro.'
          : 'Kjo veçori kërkon planin Basic ose Pro (ose trial 30-ditor).',
      code: 'PLAN_REQUIRED',
      requiredTier: minTier,
      effectiveTier: getEffectiveTier(req.user),
    });
  };
}

module.exports = {
  TRIAL_DAYS,
  HIGHLIGHT_LIMIT_BASIC,
  getEffectiveTier,
  hasTier,
  buildAccessPayload,
  getTrialEndsAt,
  isInFreeTrial,
  isProActive,
  reconcileExpiredAccess,
  persistReconcileIfNeeded,
  requireTier,
};
