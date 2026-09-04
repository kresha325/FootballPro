const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Product = require('../models/Product');
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? require('stripe')(stripeKey) : null;

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
    if (!stripe) return res.status(503).json({ msg: 'Payments are not configured' });
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ msg: 'At least one product is required' });
    }
    let totalAmount = 0;
    const orderProducts = [];

    for (const item of products) {
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ msg: 'Invalid product quantity' });
      }
      const product = await Product.findByPk(item.productId);
      if (!product || product.stock < quantity) {
        return res.status(400).json({ msg: 'Product not available or insufficient stock' });
      }
      totalAmount += parseFloat(product.price) * quantity;
      orderProducts.push({
        productId: item.productId,
        quantity,
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
    const payment = await Payment.findOne({
      where: { stripePaymentIntentId: paymentIntentId, userId: req.user.id },
    });
    if (!payment) return res.status(404).json({ msg: 'Payment not found' });

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status === 'succeeded') {
      const order = await Order.findOne({ where: { paymentId: payment.id, userId: req.user.id } });
      if (!order) return res.status(404).json({ msg: 'Order not found' });
      if (payment.status === 'completed' || order.status === 'paid') {
        return res.json({ msg: 'Order already confirmed' });
      }
      await payment.update({ status: 'completed' });
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
  if (status !== 'cancelled') {
    return res.status(403).json({ msg: 'Only cancellation is allowed from this endpoint' });
  }
  try {
    const order = await Order.findOne({ where: { id, userId: req.user.id } });
    if (!order) return res.status(404).json({ msg: 'Order not found' });
    await order.update({ status });
    res.json(order);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};