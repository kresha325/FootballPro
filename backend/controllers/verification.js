const crypto = require('crypto');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');
const { isEmailConfigured, buildParentConfirmUrl } = require('../config/email');

// Request parental verification (authenticated athlete)
exports.parentRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { parentEmail } = req.body;
    if (!parentEmail) return res.status(400).json({ error: 'parentEmail is required' });

    const normalizedParent = String(parentEmail).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedParent)) {
      return res.status(400).json({ error: 'Invalid parent email address' });
    }

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const confirmUrl = buildParentConfirmUrl(token);

    user.parentEmail = normalizedParent;
    user.parentVerificationToken = tokenHash;
    user.parentVerificationExpire = Date.now() + 7 * 24 * 60 * 60 * 1000;
    user.parentVerified = false;
    await user.save();

    const athleteName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Lojtari';
    const emailResult = await sendEmail(normalizedParent, 'parentVerification', athleteName, token);

    if (emailResult.success) {
      return res.json({
        success: true,
        emailSent: true,
        msg: 'Email-i u dërgua te prindi. Kontrollo edhe dosjen Spam.',
      });
    }

    // Email nuk u dërgua — jep linkun e konfirmimit që ta ndajë lojtari (WhatsApp, etj.)
    console.warn('Parent verification email not sent:', emailResult.error, '→', normalizedParent);

    return res.json({
      success: true,
      emailSent: false,
      emailConfigured: isEmailConfigured(),
      confirmUrl,
      warning: isEmailConfigured()
        ? `Email-i nuk u dërgua (${emailResult.error || 'gabim SMTP'}). Kopjo linkun më poshtë dhe ia dërgo prindit.`
        : 'Serveri nuk ka EMAIL_USER / EMAIL_PASSWORD (Gmail). Kopjo linkun dhe ia dërgo prindit (WhatsApp/SMS).',
      msg: 'Linku i konfirmimit u krijua',
    });
  } catch (err) {
    console.error('Parent request error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Confirm parental verification via token
exports.parentConfirm = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).send('Missing token');

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ where: { parentVerificationToken: tokenHash } });
    if (!user) return res.status(400).send('Invalid or expired token');

    if (user.parentVerificationExpire && user.parentVerificationExpire < Date.now()) {
      return res.status(400).send('Token expired');
    }

    user.parentVerified = true;
    user.parentVerificationToken = null;
    user.parentVerificationExpire = null;

    if (user.clubVerified) {
      user.verified = true;
    }

    await user.save();

    const redirectUrl = process.env.FRONTEND_URL
      ? `${process.env.FRONTEND_URL.replace(/\/$/, '')}/parent-verified`
      : '/parent-verified';
    return res.redirect(302, redirectUrl);
  } catch (err) {
    console.error('Parent confirm error:', err);
    res.status(500).send('Server error');
  }
};
