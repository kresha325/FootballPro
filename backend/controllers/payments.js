const Payment = require('../models/Payment');
const { toCents } = require('../utils/money');

exports.getPayments = async (req, res) => {
  try {
    const payments = await Payment.findAll({
      where: { userId: req.user.id },
      attributes: { exclude: ['stripeClientSecret'] },
      order: [['createdAt', 'DESC']],
    });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.createPayment = async (req, res) => {
  const amountCents = toCents(req.body?.amount);
  if (amountCents == null || amountCents <= 0) {
    return res.status(400).json({ msg: 'Shuma e pavlefshme' });
  }
  try {
    const currency = String(req.body?.currency || 'eur').trim().toLowerCase();
    if (currency !== 'eur') {
      return res.status(400).json({ msg: 'Monedha e mbështetur është EUR' });
    }
    const payment = await Payment.create({
      userId: req.user.id,
      amount: require('../utils/money').fromCents(amountCents),
      currency,
      description: req.body?.description ? String(req.body.description).slice(0, 255) : null,
      status: 'pending',
    });
    res.status(201).json(payment);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};