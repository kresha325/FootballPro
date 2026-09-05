const Notification = require('../models/Notification');
const User = require('../models/User');

exports.sendLiveNotification = async (req, res) => {
  try {
    const { userId, streamId } = req.body;
    const user = await User.findByPk(userId, { include: ['Followers'] });
    if (!user || !user.Followers) {
      return res.status(404).json({ msg: 'Përdoruesi ose ndjekësit nuk u gjetën' });
    }
    const followers = user.Followers;
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
    res.status(500).json({ msg: 'Dërgimi i njoftimeve live dështoi' });
  }
};
