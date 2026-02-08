const Notification = require('../models/Notification');
const User = require('../models/User');

exports.sendLiveNotification = async (req, res) => {
  try {
    const { userId, streamId } = req.body;
    // Gjej të gjithë ndjekësit e userit
    const user = await User.findByPk(userId, { include: ['Followers'] });
    if (!user || !user.Followers) return res.status(404).json({ error: 'User or followers not found' });
    const followers = user.Followers;
    // Dërgo njoftim për secilin
    const notifications = await Promise.all(
      followers.map(follower =>
        Notification.create({
          userId: follower.id,
          type: 'live',
          message: `Useri që ndjek shkon live! Kliko për të parë streamin.`,
          link: `/live/${streamId}`,
          read: false
        })
      )
    );
    res.status(201).json({ success: true, notifications });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send live notifications' });
  }
};
