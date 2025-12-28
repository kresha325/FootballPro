const Payment = require('../models/Payment');

exports.getPayments = async (req, res) => {
  try {
    const payments = await Payment.findAll({ where: { userId: req.user.id } });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.createPayment = async (req, res) => {
  const { amount, currency, description } = req.body;
  try {
    const payment = await Payment.create({
      userId: req.user.id,
      amount,
      currency,
      description,
      status: 'pending', // In real app, integrate with payment gateway
    });
    res.json(payment);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.updatePaymentStatus = async (req, res) => {
  const { status } = req.body;
  try {
    const payment = await Payment.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!payment) return res.status(404).json({ msg: 'Payment not found' });
    await payment.update({ status });
    res.json(payment);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};