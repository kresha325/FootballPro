const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Product = require('../models/Product');
const stripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';
const stripe = require('stripe')(stripeKey);

exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({ where: { userId: req.user.id } });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!order) return res.status(404).json({ msg: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.createOrder = async (req, res) => {
  const { products } = req.body; // products: [{ productId, quantity }]
  try {
    let totalAmount = 0;
    const orderProducts = [];

    for (const item of products) {
      const product = await Product.findByPk(item.productId);
      if (!product || product.stock < item.quantity) {
        return res.status(400).json({ msg: 'Product not available or insufficient stock' });
      }
      totalAmount += parseFloat(product.price) * item.quantity;
      orderProducts.push({
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
      });
    }

    // Create payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalAmount * 100), // Stripe expects amount in cents
      currency: 'usd',
      metadata: { userId: req.user.id },
    });

    // Create payment record
    const payment = await Payment.create({
      userId: req.user.id,
      amount: totalAmount,
      currency: 'USD',
      description: 'Order payment',
      status: 'pending',
      stripePaymentIntentId: paymentIntent.id,
      stripeClientSecret: paymentIntent.client_secret,
    });

    // Create order
    const order = await Order.create({
      userId: req.user.id,
      products: orderProducts,
      totalAmount,
      status: 'pending',
      paymentId: payment.id,
    });

    res.json({ order, clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.confirmOrder = async (req, res) => {
  const { paymentIntentId } = req.body;
  try {
    const payment = await Payment.findOne({ where: { stripePaymentIntentId: paymentIntentId } });
    if (!payment) return res.status(404).json({ msg: 'Payment not found' });

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status === 'succeeded') {
      await payment.update({ status: 'completed' });
      const order = await Order.findOne({ where: { paymentId: payment.id } });
      await order.update({ status: 'paid' });

      // Reduce stock
      for (const item of order.products) {
        const product = await Product.findByPk(item.productId);
        await product.update({ stock: product.stock - item.quantity });
      }

      res.json({ msg: 'Order confirmed' });
    } else {
      res.status(400).json({ msg: 'Payment not successful' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const order = await Order.findOne({ where: { id, userId: req.user.id } });
    if (!order) return res.status(404).json({ msg: 'Order not found' });
    await order.update({ status });
    res.json(order);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};