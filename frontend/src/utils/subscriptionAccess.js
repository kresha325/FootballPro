/**
 * Client-side helpers mirroring backend/utils/subscriptionAccess.js
 */

const TRIAL_DAYS = 30;
const TIER_RANK = { free: 0, basic: 1, pro: 2 };

export function getTrialEndsAt(user) {
  if (!user?.createdAt) return null;
  const start = new Date(user.createdAt).getTime();
  if (!Number.isFinite(start)) return null;
  return new Date(start + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

export function getEffectiveTier(user) {
  if (!user) return 'free';
  if (user.effectiveTier) return user.effectiveTier;
  if (user.access?.effectiveTier) return user.access.effectiveTier;
  if (String(user.role || '').toLowerCase() === 'admin') return 'pro';

  const now = Date.now();
  const plan = String(user.subscriptionPlan || 'free').toLowerCase();
  const premiumActive =
    !!user.premium &&
    (!user.premiumExpiresAt || new Date(user.premiumExpiresAt).getTime() > now);
  if (premiumActive || plan === 'premium' || plan === 'pro') {
    if (!user.premiumExpiresAt || new Date(user.premiumExpiresAt).getTime() > now) return 'pro';
  }
  if (plan === 'basic') return 'basic';

  const trialEnd = getTrialEndsAt(user);
  if (trialEnd && trialEnd.getTime() > now) return 'basic';
  return 'free';
}

export function hasTier(user, minTier = 'basic') {
  return (TIER_RANK[getEffectiveTier(user)] || 0) >= (TIER_RANK[minTier] || 0);
}

export function tierLabel(tier) {
  if (tier === 'pro') return 'Pro';
  if (tier === 'basic') return 'Basic';
  return 'Free';
}
