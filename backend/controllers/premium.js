const stripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';
const stripe = require('stripe')(stripeKey);
const User = require('../models/User');
const Payment = require('../models/Payment');
const { stripeLiveReady } = require('../config/payments');
const { createInvoiceIfNeeded } = require('../utils/invoices');

/** Pro tier: €11.99/mo · yearly = 10× monthly (€119.90, 2 months free). */
const PLANS = {
  monthly: {
    name: 'X TALENTI Pro — Monthly',
    amountCents: 1199,
    days: 30,
    label: 'Monthly',
  },
  yearly: {
    name: 'X TALENTI Pro — Yearly',
    amountCents: 11990,
    days: 365,
    label: 'Yearly',
  },
};

function stripeConfigured() {
  return stripeLiveReady();
}

function frontendBase() {
  return (process.env.FRONTEND_URL || 'https://xtalenti.com').replace(/\/$/, '');
}

/**
 * @param {number} userId
 * @param {string} plan
 * @param {string|null} sessionId - Stripe session id, or `iap:{txId}`, or null for demo
 * @param {{ productId?: string, iapPurchaseId?: number, source?: string }} [opts]
 */
async function activatePremiumForUser(userId, plan, sessionId = null, opts = {}) {
  const config = PLANS[plan] || PLANS.monthly;
  const transaction = opts.transaction;
  const user = await User.findByPk(userId, { transaction, lock: transaction ? transaction.LOCK.UPDATE : undefined });
  if (!user) return null;

  const marker = sessionId ? String(sessionId).slice(0, 255) : null;
  if (marker) {
    const existing = await Payment.findOne({
      where: { stripePaymentIntentId: marker, status: 'completed' },
      transaction,
    });
    if (existing) {
      return {
        premium: Boolean(user.premium),
        plan,
        alreadyProcessed: true,
        expiresAt: user.premiumExpiresAt ? new Date(user.premiumExpiresAt).toISOString() : null,
        user: {
          id: user.id,
          premium: user.premium,
          premiumExpiresAt: user.premiumExpiresAt,
          subscriptionPlan: user.subscriptionPlan,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      };
    }
  }

  user.premium = true;
  user.subscriptionPlan = 'premium';

  const now = new Date();
  const currentExpiry =
    user.premiumExpiresAt && new Date(user.premiumExpiresAt) > now
      ? new Date(user.premiumExpiresAt)
      : now;
  const expiresAt = new Date(currentExpiry);
  expiresAt.setDate(expiresAt.getDate() + config.days);
  user.premiumExpiresAt = expiresAt;

  const { syncOverallVerified } = require('../utils/userVerification');
  syncOverallVerified(user);
  try {
    await user.save({ transaction });
  } catch (saveErr) {
    console.warn('Premium save with expiry failed, retrying flag only:', saveErr?.message || saveErr);
    await User.update({ premium: true }, { where: { id: userId } });
  }

  let paymentId = null;
  let source = opts.source;
  if (!source) {
    if (!sessionId) source = 'demo';
    else if (String(sessionId).startsWith('iap:')) source = 'iap';
    else source = 'stripe';
  }

  const externalId =
    sessionId ||
    opts.externalId ||
    `${source}:premium:${userId}:${plan}:${Date.now()}`;

  if (sessionId || source === 'demo' || source === 'sponsor') {
    try {
      const payment = await Payment.create({
        userId,
        amount: source === 'sponsor' ? '0.00' : require('../utils/money').fromCents(config.amountCents),
        currency: 'eur',
        status: 'completed',
        stripePaymentIntentId: String(externalId).slice(0, 255),
        description:
          source === 'sponsor'
            ? `Premium ${config.label} (sponsor)`
            : `Premium ${config.label}${source === 'demo' ? ' (demo)' : ''}`,
      }, { transaction });
      paymentId = payment.id;
    } catch (payErr) {
      console.warn('Premium payment record skipped:', payErr?.message);
    }
  }

  let invoice = null;
  if (source !== 'sponsor') {
    try {
      const inv = await createInvoiceIfNeeded({
        userId,
        kind: 'premium',
        source,
        amount: require('../utils/money').fromCents(config.amountCents),
        currency: 'EUR',
        description: config.name,
        plan,
        productId: opts.productId || null,
        externalId,
        paymentId,
        iapPurchaseId: opts.iapPurchaseId || null,
        rawPayload: {
          plan,
          days: config.days,
          source,
        },
      });
      invoice = inv.invoice;
    } catch (invErr) {
      console.warn('Premium invoice skipped:', invErr?.message || invErr);
    }
  }

  return {
    premium: true,
    plan,
    expiresAt: expiresAt.toISOString(),
    invoice,
    user: {
      id: user.id,
      premium: user.premium,
      premiumExpiresAt: user.premiumExpiresAt,
      subscriptionPlan: user.subscriptionPlan,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  };
}

async function activatePremiumFromStripeSession(session) {
  if (!session?.metadata || session.metadata.type !== 'premium') return null;
  const userId = parseInt(session.metadata.userId, 10);
  const plan = session.metadata.plan || 'monthly';
  if (!Number.isFinite(userId)) return null;
  if (session.payment_status !== 'paid') return null;
  return activatePremiumForUser(userId, plan, session.id);
}

exports.PLANS = PLANS;
exports.activatePremiumForUser = activatePremiumForUser;

function demoPremiumAllowed() {
  const flag = String(process.env.PREMIUM_DEMO_MODE || '').trim().toLowerCase();
  if (flag === 'true' || flag === '1') return true;
  if (process.env.NODE_ENV === 'production') return false;
  return !stripeConfigured();
}

exports.createPremiumCheckout = async (req, res) => {
  try {
    const plan = req.body?.plan === 'yearly' ? 'yearly' : 'monthly';
    const config = PLANS[plan];
    const userId = req.user.id;
    const method = String(req.body?.paymentMethod || '').toLowerCase();

    if (method === 'joncoin' || method === 'xcoin') {
      const { eurCentsToJoncoinCents, fromCents } = require('../config/economy');
      const { postLedgerEntry } = require('../services/economy/ledger');
      const sequelize = require('../config/database');
      const coinCents = eurCentsToJoncoinCents(config.amountCents);
      const idem = String(req.get('Idempotency-Key') || req.body?.idempotencyKey || `${userId}:${plan}:${Math.floor(Date.now() / 60000)}`).slice(0, 80);
      const marker = `joncoin:premium:${idem}`.slice(0, 255);
      const result = await sequelize.transaction(async (transaction) => {
        const posted = await postLedgerEntry({
          userId,
          type: 'subscription',
          amountCents: coinCents,
          status: 'completed',
          idempotencyKey: marker,
          description: `Premium ${config.label}`,
          relatedEntityType: 'premium',
        }, transaction);
        if (posted.duplicate) {
          const current = await User.findByPk(userId, { transaction });
          return { duplicate: true, user: current };
        }
        return activatePremiumForUser(userId, plan, marker, { source: 'joncoin', transaction });
      });
      if (result?.duplicate) {
        return res.json({ success: true, duplicate: true, mode: 'joncoin', amount: fromCents(coinCents), ...result });
      }
      return res.json({ mode: 'joncoin', success: true, amount: fromCents(coinCents), currency: 'JON', ...result });
    }

    if (!stripeConfigured()) {
      if (!demoPremiumAllowed()) {
        return res.status(503).json({ msg: 'Pagesat premium me kartë nuk janë aktive. Përdor XCoin ose aktivizo Stripe.' });
      }
      const result = await activatePremiumForUser(userId, plan, null, { source: 'demo' });
      if (!result) return res.status(404).json({ msg: 'User not found' });
      return res.json({
        mode: 'demo',
        success: true,
        message: 'Premium aktiv (demo). Pagesat me kartë nuk janë aktive.',
        ...result,
      });
    }

    const base = frontendBase();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: config.name },
            unit_amount: config.amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'premium',
        userId: String(userId),
        plan,
        days: String(config.days),
      },
      success_url: `${base}/premium?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/premium?canceled=1`,
    });

    res.json({
      mode: 'stripe',
      url: session.url,
      sessionId: session.id,
      plan,
    });
  } catch (err) {
    console.error('createPremiumCheckout:', err);
    res.status(500).json({ msg: 'Could not start checkout', error: err.message });
  }
};

exports.verifyPremiumSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ msg: 'sessionId required' });

    if (!stripeConfigured()) {
      return res.status(400).json({ msg: 'Stripe is not configured' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (String(session.metadata?.userId) !== String(req.user.id)) {
      return res.status(403).json({ msg: 'Session does not belong to this user' });
    }

    if (session.payment_status !== 'paid') {
      return res.json({ success: false, paymentStatus: session.payment_status });
    }

    const result = await activatePremiumFromStripeSession(session);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('verifyPremiumSession:', err);
    res.status(500).json({ msg: 'Failed to verify session', error: err.message });
  }
};

exports.activatePremiumFromStripeSession = activatePremiumFromStripeSession;
