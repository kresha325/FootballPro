const crypto = require('crypto');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');

// Request parental verification (authenticated athlete)
exports.parentRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { parentEmail } = req.body;
    if (!parentEmail) return res.status(400).json({ error: 'parentEmail is required' });

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Generate token and save hashed
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    user.parentEmail = parentEmail;
    user.parentVerificationToken = tokenHash;
    user.parentVerificationExpire = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    user.parentVerified = false;
    await user.save();

    // Send email to parent with raw token link
    await sendEmail(parentEmail, 'parentVerification', `${user.firstName} ${user.lastName}`, token);

    res.json({ success: true, msg: 'Parent verification email sent' });
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

    // If club already verified, mark final verified
    if (user.clubVerified) {
      user.verified = true;
    }

    await user.save();

    // Redirect to frontend confirmation page if available
    const redirectUrl = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/parent-verified` : '/parent-verified';
    return res.redirect(302, redirectUrl);
  } catch (err) {
    console.error('Parent confirm error:', err);
    res.status(500).send('Server error');
  }
};
