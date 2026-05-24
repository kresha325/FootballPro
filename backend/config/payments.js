'use strict';

/**
 * Live card payments (Stripe) are OFF unless PAYMENTS_ENABLED=true.
 * Premium can still activate in demo mode for testing.
 */
function paymentsLiveEnabled() {
  const flag = String(process.env.PAYMENTS_ENABLED || '').trim().toLowerCase();
  if (flag === 'true' || flag === '1' || flag === 'yes') return true;
  return false;
}

function stripeSecretConfigured() {
  const key = process.env.STRIPE_SECRET_KEY || '';
  return key && !key.includes('dummy') && key.startsWith('sk_');
}

function stripeLiveReady() {
  return paymentsLiveEnabled() && stripeSecretConfigured();
}

module.exports = {
  paymentsLiveEnabled,
  stripeSecretConfigured,
  stripeLiveReady,
};
