const Payment = require('../models/Payment');
const User = require('../models/User');
const PaymentEvent = require('../models/PaymentEvent');
const { activatePremiumFromStripeSession } = require('./premium');
const { creditVerifiedDeposit } = require('./joncoin');
const { joncoinCentsToEurCents } = require('../config/economy');

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY || '';
  if (!key || key.includes('dummy') || !key.startsWith('sk_')) return null;
  return require('stripe')(key);
}

exports.createCheckoutSession = async (req, res) => {
  return res.status(400).json({
    msg: 'Marketplace purchases use XCoin. Use POST /api/orders. Card deposits use POST /api/joncoin/deposit-checkout.',
  });
};

exports.stripeWebhook = async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = stripeClient();
  if (!secret || !stripe) {
    return res.status(503).send('Webhook is not configured');
  }
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send('Webhook Error');
  }

  try {
    const existing = await PaymentEvent.findOne({ where: { provider: 'stripe', eventId: event.id } });
    if (existing) return res.json({ received: true, duplicate: true });

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.metadata?.type === 'premium') await activatePremiumFromStripeSession(session);
      else if (session.metadata?.type === 'joncoin_deposit') await creditDepositFromSession(session);
    } else if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object;
      if (intent?.id) {
        await Payment.update({ status: 'failed' }, { where: { stripePaymentIntentId: intent.id, status: 'pending' } });
      }
    }

    await PaymentEvent.create({ provider: 'stripe', eventId: event.id, type: event.type });
    return res.json({ received: true });
  } catch (err) {
    console.error('stripe webhook:', err);
    return res.status(500).json({ msg: 'Webhook processing failed' });
  }
};

async function creditDepositFromSession(session) {
  if (session.payment_status !== 'paid') return null;
  const userId = parseInt(session.metadata?.userId, 10);
  const amountCents = parseInt(session.metadata?.joncoinCents, 10);
  if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(amountCents) || amountCents <= 0) return null;
  const expectedEur = joncoinCentsToEurCents(amountCents);
  if (expectedEur == null || Number(session.amount_total) !== expectedEur) {
    console.error('JonCoin deposit amount mismatch', session.id);
    return null;
  }
  const user = await User.findByPk(userId);
  if (!user) return null;
  return creditVerifiedDeposit({
    userId,
    amountCents,
    idempotencyKey: `stripe:deposit:${session.id}`,
    description: `XCoin deposit ${session.id}`,
  });
}

exports.getPayments = async (req, res) => {
  try {
    const payments = await Payment.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      attributes: { exclude: ['stripeClientSecret'] },
    });
    res.json(payments);
  } catch (err) {
    console.error('Get payments error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.verifySession = async (req, res) => {
  try {
    const stripe = stripeClient();
    if (!stripe) return res.status(503).json({ msg: 'Stripe is not configured' });
    const { sessionId } = req.params;
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (String(session.metadata?.userId || '') !== String(req.user.id)) {
      return res.status(403).json({ msg: 'Session does not belong to this user' });
    }
    if (session.metadata?.type === 'premium' && session.payment_status === 'paid') {
      const result = await activatePremiumFromStripeSession(session);
      return res.json({ success: true, premium: true, ...result });
    }
    if (session.metadata?.type === 'joncoin_deposit' && session.payment_status === 'paid') {
      const result = await creditDepositFromSession(session);
      return res.json({ success: true, deposit: true, duplicate: Boolean(result?.duplicate) });
    }
    return res.json({ success: session.payment_status === 'paid', paymentStatus: session.payment_status });
  } catch (error) {
    console.error('Session verification error:', error);
    res.status(500).json({ msg: 'Failed to verify session' });
  }
};
