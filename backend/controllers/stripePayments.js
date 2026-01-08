const stripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';
const stripe = require('stripe')(stripeKey);
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

// Create Stripe Checkout Session
exports.createCheckoutSession = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ msg: 'Product not found' });
    }

    if (product.stock < quantity) {
      return res.status(400).json({ msg: 'Not enough stock' });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: product.name,
              description: product.description,
              images: product.imageUrl ? [`${process.env.FRONTEND_URL || 'http://localhost:5174'}${product.imageUrl}`] : [],
            },
            unit_amount: Math.round(product.price * 100), // Convert to cents
          },
          quantity,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5174'}/marketplace?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5174'}/marketplace?canceled=true`,
      metadata: {
        userId: req.user.id,
        productId: product.id,
        quantity,
      },
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    res.status(500).json({ msg: 'Failed to create checkout session', error: error.message });
  }
};

// Stripe Webhook - Handle payment success
exports.stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      await handleSuccessfulPayment(session);
      break;
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('PaymentIntent was successful!', paymentIntent.id);
      break;
    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log('Payment failed:', failedPayment.id);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
};

// Handle successful payment
async function handleSuccessfulPayment(session) {
  try {
    const { userId, productId, quantity } = session.metadata;

    const product = await Product.findByPk(productId);
    if (!product) {
      console.error('Product not found:', productId);
      return;
    }

    // Create order
    const order = await Order.create({
      userId: parseInt(userId),
      productId: parseInt(productId),
      quantity: parseInt(quantity),
      totalPrice: session.amount_total / 100, // Convert from cents
      status: 'completed',
    });

    // Create payment record
    await Payment.create({
      userId: parseInt(userId),
      orderId: order.id,
      amount: session.amount_total / 100,
      currency: session.currency,
      stripePaymentId: session.payment_intent,
      status: 'succeeded',
      description: `Payment for ${product.name}`,
    });

    // Update product stock
    product.stock -= parseInt(quantity);
    await product.save();

    console.log('✅ Order completed:', order.id);
  } catch (error) {
    console.error('Error handling successful payment:', error);
  }
}

// Get payment history
exports.getPayments = async (req, res) => {
  try {
    const payments = await Payment.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Order,
          include: [{ model: Product }],
        },
      ],
    });
    res.json(payments);
  } catch (err) {
    console.error('Get payments error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Verify payment session
exports.verifySession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status === 'paid') {
      res.json({ success: true, session });
    } else {
      res.json({ success: false, session });
    }
  } catch (error) {
    console.error('Session verification error:', error);
    res.status(500).json({ msg: 'Failed to verify session' });
  }
};

module.exports = exports;
