const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Notification = require('../models/Notification');
const Follow = require('../models/Follow');
const Block = require('../models/Block');
const Report = require('../models/Report');
const { Op } = require('sequelize');

/**
 * Soft-delete / anonymize account for App Store compliance.
 * Keeps financial rows (orders/payments/joncoin) for retention; clears PII where safe.
 */
exports.deleteMyAccount = async (req, res) => {
  try {
    const { password, confirm } = req.body || {};
    if (String(confirm || '').toUpperCase() !== 'DELETE') {
      return res.status(400).json({
        msg: 'Shkruaj DELETE për të konfirmuar fshirjen e llogarisë',
      });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ msg: 'Përdoruesi nuk u gjet' });
    if (user.deletedAt) {
      return res.status(400).json({ msg: 'Llogaria është tashmë e fshirë' });
    }

    if (user.password && String(user.password).startsWith('$2')) {
      if (!password) {
        return res.status(400).json({ msg: 'Fjalëkalimi është i detyrueshëm' });
      }
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) return res.status(400).json({ msg: 'Fjalëkalimi është i pasaktë' });
    }

    const anonEmail = `deleted+${user.id}@xtalenti.invalid`;
    const randomHash = await bcrypt.hash(`deleted-${user.id}-${Date.now()}`, 10);

    user.email = anonEmail;
    user.password = randomHash;
    user.firstName = 'Deleted';
    user.lastName = 'User';
    user.pushTokenMobile = null;
    user.pushTokenWeb = null;
    user.googleId = null;
    user.facebookId = null;
    user.resetPasswordToken = null;
    user.resetPasswordExpire = null;
    user.parentEmail = null;
    user.parentVerificationToken = null;
    user.deletedAt = new Date();
    user.deletionRequestedAt = user.deletionRequestedAt || new Date();
    user.bannedAt = user.bannedAt || new Date();
    user.banReason = user.banReason || 'account_deleted';
    await user.save();

    const profile = await Profile.findOne({ where: { userId: user.id } });
    if (profile) {
      await profile.update({
        bio: null,
        profilePicture: null,
        coverPhoto: null,
        city: null,
        country: null,
        contact: null,
        youtubeChannelId: null,
      });
    }

    await Notification.destroy({ where: { userId: user.id } });
    await Follow.destroy({
      where: {
        [Op.or]: [{ followerId: user.id }, { followingId: user.id }],
      },
    });
    await Block.destroy({
      where: {
        [Op.or]: [{ blockerId: user.id }, { blockedId: user.id }],
      },
    });
    await Report.destroy({ where: { reporterId: user.id } });

    res.json({
      msg: 'Llogaria u fshi. Të dhënat personale u anonimizuan; të dhënat financiare ruhen sipas kërkesave ligjore.',
    });
  } catch (err) {
    console.error('deleteMyAccount error:', err);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};
