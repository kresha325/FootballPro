const stripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';
const stripe = require('stripe')(stripeKey);
const User = require('../models/User');
const Payment = require('../models/Payment');
const { stripeLiveReady } = require('../config/payments');

const PLANS = {
  monthly: {
    name: 'XTalenti Premium — Monthly',
    amountCents: 999,
    days: 30,
    label: 'Monthly',
  },
  yearly: {
    name: 'XTalenti Premium — Yearly',
    amountCents: 9999,
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

async function activatePremiumForUser(userId, plan, sessionId = null) {
  const config = PLANS[plan] || PLANS.monthly;
  const user = await User.findByPk(userId);
  if (!user) return null;

  user.premium = true;
  await user.save();

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + config.days);

  if (sessionId) {
    try {
      await Payment.create({
        userId,
        amount: config.amountCents / 100,
        currency: 'eur',
        status: 'completed',
        stripePaymentIntentId: sessionId,
        description: `Premium ${config.label}`,
      });
    } catch (payErr) {
      console.warn('Premium payment record skipped:', payErr?.message);
    }
  }

  return {
    premium: true,
    plan,
    expiresAt: expiresAt.toISOString(),
    user: {
      id: user.id,
      premium: user.premium,
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

exports.createPremiumCheckout = async (req, res) => {
  try {
    const plan = req.body?.plan === 'yearly' ? 'yearly' : 'monthly';
    const config = PLANS[plan];
    const userId = req.user.id;

    if (!stripeConfigured()) {
      const result = await activatePremiumForUser(userId, plan);
      if (!result) return res.status(404).json({ msg: 'User not found' });
      return res.json({
        mode: 'demo',
        success: true,
        message:
          'Premium aktiv (demo). Pagesat me kartë nuk janë aktive — vendos PAYMENTS_ENABLED=true vetëm kur të jesh gati për Stripe.',
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
