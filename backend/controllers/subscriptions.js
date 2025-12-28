const Subscription = require('../models/Subscription');
const { sendNotification } = require('./notifications');

exports.subscribe = async (req, res) => {
  try {
    const existingSub = await Subscription.findOne({ where: { subscriberId: req.user.id, subscribedToId: req.params.userId } });
    if (existingSub) return res.status(400).json({ msg: 'Already subscribed' });
    const sub = await Subscription.create({
      subscriberId: req.user.id,
      subscribedToId: req.params.userId,
    });
    // Send notification to subscribed user
    await sendNotification(req.params.userId, 'New Follower', `${req.user.firstName} started following you`, { type: 'follow', followerId: req.user.id });
    res.json(sub);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.unsubscribe = async (req, res) => {
  try {
    const sub = await Subscription.findOne({ where: { subscriberId: req.user.id, subscribedToId: req.params.userId } });
    if (!sub) return res.status(404).json({ msg: 'Subscription not found' });
    await sub.destroy();
    res.json({ msg: 'Unsubscribed' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getSubscriptions = async (req, res) => {
  try {
    const subs = await Subscription.findAll({ where: { subscriberId: req.user.id }, include: [{ model: require('../models/User'), as: 'subscribedTo', attributes: ['id', 'firstName', 'lastName'] }] });
    res.json(subs);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getSubscribers = async (req, res) => {
  try {
    const subs = await Subscription.findAll({ where: { subscribedToId: req.user.id }, include: [{ model: require('../models/User'), as: 'subscriber', attributes: ['id', 'firstName', 'lastName'] }] });
    res.json(subs);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};