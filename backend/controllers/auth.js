const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Profile = require('../models/Profile');
const { sendEmail } = require('../services/emailService');

exports.register = async (req, res) => {
  console.log('BACKEND: REGISTER BODY:', req.body);

  const { email, password, role, firstName, lastName, dateOfBirth } = req.body;

  try {
    // 1. Validim bazë
    if (!email || !password || !firstName || !lastName) {
      console.log('BACKEND: Missing required fields');
      return res.status(400).json({ msg: 'All fields are required' });
    }

    // 2. Kontrollo nëse ekziston user
    console.log('BACKEND: Checking if user exists with email:', email);
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      console.log('BACKEND: User already exists');
      return res.status(400).json({ msg: 'User already exists' });
    }

    // 3. Hash password
    console.log('BACKEND: Hashing password...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Krijo user real (inkluziv dateOfBirth nëse ofrohet)
    console.log('BACKEND: Creating user...');
    const userPayload = {
      email,
      password: hashedPassword,
      role: role || 'athlete',
      firstName,
      lastName,
    };
    if (dateOfBirth) {
      userPayload.dateOfBirth = dateOfBirth;
    }
    const user = await User.create(userPayload);

    // 4.5 Krijo profile automatikisht (best-effort)
    console.log('BACKEND: Creating profile for user (best-effort):', user.id);
    try {
      await Profile.create({
        userId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        dateOfBirth: user.dateOfBirth || null,
      }, { fields: ['userId', 'firstName', 'lastName', 'email', 'dateOfBirth'] });
    } catch (profileErr) {
      console.warn('BACKEND: Profile creation failed (non-fatal):', profileErr && profileErr.message);
    }

    console.log('BACKEND: User created successfully:', user.id);

    // 4.6 Send welcome email in background (do not block auth flow)
    Promise.resolve()
      .then(() => sendEmail(user.email, 'welcome', user.firstName))
      .then(() => {
        console.log('BACKEND: Welcome email sent');
      })
      .catch((emailError) => {
        console.error('BACKEND: Email sending failed:', emailError);
      });

    // 5. Check age and JWT
    const payload = { user: { id: user.id } };
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ msg: 'Authentication is not configured' });
    }
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    // Determine if parent verification is required (under 18)
    let requiresParentVerification = false;
    if (user.dateOfBirth) {
      const today = new Date();
      const birth = new Date(user.dateOfBirth);
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      if (age < 18) requiresParentVerification = true;
    }

    console.log('BACKEND: Sending success response');
    // 6. Response
    res.status(201).json({
      success: true,
      token,
      requiresParentVerification,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        dateOfBirth: user.dateOfBirth || null,
      },
    });
  } catch (err) {
    console.error('BACKEND: REGISTER ERROR:', err);
    console.error('BACKEND: Error message:', err.message);
    console.error('BACKEND: Error stack:', err.stack);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};



exports.login = async (req, res) => {
  console.log('BACKEND: LOGIN REQUEST:', req.body);
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ where: { email } });
    console.log('BACKEND: User found:', user ? user.id : 'not found');
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Krijo profil automatikisht nëse nuk ekziston (best-effort)
    const existingProfile = await Profile.findOne({ where: { userId: user.id }, attributes: ['id', 'userId'] });
    if (!existingProfile) {
      try {
        await Profile.create({ userId: user.id }, { fields: ['userId'] });
        console.log('BACKEND: Profile created automatically for user:', user.id);
      } catch (profileErr) {
        console.warn('BACKEND: Failed to auto-create profile for user (non-fatal):', profileErr && profileErr.message);
      }
    }

    const payload = {
      user: {
        id: user.id,
        role: user.role
      }
    };

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ msg: 'Authentication is not configured' });
    }
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });
    console.log('BACKEND: Login successful, sending token');
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });

  } catch (err) {
    console.error('BACKEND: LOGIN ERROR:', err);
    res.status(500).json({ msg: 'Server error', error: err && err.message });
  }
};

// Forgot Password - Request reset token
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ where: { email } });
    
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({ msg: 'If that email exists, a reset link has been sent.' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    // Save hashed token and expiry (1 hour)
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpire = Date.now() + 3600000; // 1 hour
    await user.save();

    // Create reset URL with token
    const resetUrl = `${process.env.FRONTEND_URL || 'https://192.168.100.57:5174'}/reset-password/${resetToken}`;
    
    // Send password reset email
    try {
      await sendEmail(user.email, 'passwordReset', resetUrl);
      console.log('✅ Password reset email sent to:', user.email);
    } catch (emailError) {
      console.error('⚠️ Failed to send password reset email:', emailError);
      // Still return success even if email fails, but log the error
    }

    res.json({ 
      msg: 'If that email exists, a password reset link has been sent.',
      // Remove this in production:
      resetUrl // Only for development debugging
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Reset Password - Set new password with token
exports.resetPassword = async (req, res) => {
  const { token, password } = req.body;

  try {
    // Hash the token from URL to compare with stored hash
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid token and not expired
    const user = await User.findOne({
      where: {
        resetPasswordToken: resetTokenHash,
      }
    });

    if (!user) {
      return res.status(400).json({ msg: 'Invalid or expired reset token' });
    }

    // Check if token is expired
    if (user.resetPasswordExpire < Date.now()) {
      return res.status(400).json({ msg: 'Reset token has expired' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update password and clear reset fields
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpire = null;
    await user.save();

    res.json({ msg: 'Password has been reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};
