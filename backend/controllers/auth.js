const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Profile = require('../models/Profile');
const { sendEmail } = require('../services/emailService');
const {
  ALLOWED_REGISTER_ROLES,
  parseDateOnly,
  ageFromDateOnly,
} = require('../utils/registerValidation');
const { getJwtSecret } = require('../utils/jwtSecret');

function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

exports.register = async (req, res) => {
  console.log('BACKEND: REGISTER BODY:', req.body);

  const { email: rawEmail, password, role, firstName, lastName, dateOfBirth, city, country } = req.body;
  const email = normalizeEmail(rawEmail);

  try {
    // 1. Validim bazë
    if (!email || !password || !firstName || !lastName) {
      console.log('BACKEND: Missing required fields');
      return res.status(400).json({ msg: 'Të gjitha fushat janë të detyrueshme' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ msg: 'Adresa e email-it është e pavlefshme' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ msg: 'Fjalëkalimi duhet të ketë të paktën 6 karaktere' });
    }

    const normalizedRole = String(role || 'athlete').trim().toLowerCase();
    if (!ALLOWED_REGISTER_ROLES.includes(normalizedRole)) {
      return res.status(400).json({ msg: 'Lloji i llogarisë është i pavlefshëm' });
    }

    let parsedDob = null;
    if (dateOfBirth) {
      const dob = parseDateOnly(dateOfBirth);
      if (!dob.valid) {
        return res.status(400).json({ msg: 'Data e lindjes është e pavlefshme (përdor YYYY-MM-DD)' });
      }
      parsedDob = dob.value;
      if (normalizedRole === 'athlete' && ageFromDateOnly(parsedDob) < 6) {
        return res.status(400).json({ msg: 'Atletët duhet të jenë të paktën 6 vjeç' });
      }
    }

    // 2. Kontrollo nëse ekziston user
    console.log('BACKEND: Checking if user exists with email:', email);
    const existingUser = await User.findOne({
      where: User.sequelize.where(
        User.sequelize.fn('LOWER', User.sequelize.col('email')),
        email
      ),
    });
    if (existingUser) {
      console.log('BACKEND: User already exists');
      return res.status(400).json({ msg: 'Përdoruesi ekziston tashmë' });
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
      role: normalizedRole,
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
    };
    if (parsedDob) {
      userPayload.dateOfBirth = parsedDob;
    }
    const user = await User.create(userPayload);

    // 4.5 Krijo profile automatikisht (best-effort)
    console.log('BACKEND: Creating profile for user (best-effort):', user.id);
    try {
      await Profile.create({
        userId: user.id,
        city: city ? String(city).trim() : null,
        country: country ? String(country).trim() : null,
      });
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
    const token = jwt.sign(payload, getJwtSecret(), {
      expiresIn: '7d',
    });

    // Determine if parent verification is required (under 18)
    const requiresParentVerification =
      !!user.dateOfBirth && ageFromDateOnly(user.dateOfBirth) < 18;

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
    res.status(500).json({ msg: 'Gabim në server', error: err.message });
  }
};



exports.login = async (req, res) => {
  console.log('BACKEND: LOGIN REQUEST:', req.body);
  const { email: rawEmail, password } = req.body;
  const email = normalizeEmail(rawEmail);

  try {
    if (!email || !password) {
      return res.status(400).json({ msg: 'Email-i dhe fjalëkalimi janë të detyrueshëm' });
    }

    const user = await User.findOne({
      where: User.sequelize.where(
        User.sequelize.fn('LOWER', User.sequelize.col('email')),
        email
      ),
    });
    console.log('BACKEND: User found:', user ? user.id : 'not found');
    if (!user) {
      return res.status(400).json({ msg: 'Kredencialet janë të pasakta' });
    }

    if (!user.password || !String(user.password).startsWith('$2')) {
      if (user.googleId) {
        return res.status(400).json({
          msg: 'Kjo llogari përdor hyrjen me Google në web. Përdor “Ke harruar fjalëkalimin?” në aplikacion për të vendosur fjalëkalim.',
        });
      }
      if (user.facebookId) {
        return res.status(400).json({
          msg: 'Kjo llogari përdor hyrjen me Facebook në web. Përdor “Ke harruar fjalëkalimin?” në aplikacion për të vendosur fjalëkalim.',
        });
      }
      return res.status(400).json({ msg: 'Kredencialet janë të pasakta' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Kredencialet janë të pasakta' });
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

    const token = jwt.sign(payload, getJwtSecret(), {
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
    res.status(500).json({ msg: 'Gabim në server', error: err && err.message });
  }
};

// Forgot Password - Request reset token
exports.forgotPassword = async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  try {
    const user = await User.findOne({
      where: User.sequelize.where(
        User.sequelize.fn('LOWER', User.sequelize.col('email')),
        email
      ),
    });
    
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({ msg: 'Nëse ky email ekziston, është dërguar linku për rivendosje.' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    // Save hashed token and expiry (1 hour)
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpire = Date.now() + 3600000; // 1 hour
    await user.save();

    const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:5174').replace(/\/$/, '');
    const resetUrl = `${baseUrl}/reset-password/${resetToken}`;

    let emailSent = false;
    try {
      const emailResult = await sendEmail(user.email, 'passwordReset', user.firstName || 'User', resetUrl);
      emailSent = !!(emailResult && emailResult.success);
    } catch (emailErr) {
      console.error('Password reset email error:', emailErr);
    }

    const payload = {
      msg: 'Nëse ky email ekziston, është dërguar linku për rivendosje.',
    };
    const isNonProduction = process.env.NODE_ENV !== 'production';
    if (isNonProduction) {
      payload.resetUrl = resetUrl;
      if (!emailSent) {
        payload.emailHint = 'Dërgimi i email-it dështoi ose nuk është i konfiguruar; përdor resetUrl vetëm në development.';
      }
    } else if (!emailSent) {
      console.warn('Password reset: email not sent for user id', user.id);
    }

    res.json(payload);
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ msg: 'Gabim në server' });
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
      return res.status(400).json({ msg: 'Tokeni i rivendosjes është i pavlefshëm ose i skaduar' });
    }

    // Check if token is expired
    if (user.resetPasswordExpire < Date.now()) {
      return res.status(400).json({ msg: 'Tokeni i rivendosjes ka skaduar' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update password and clear reset fields
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpire = null;
    await user.save();

    res.json({ msg: 'Fjalëkalimi u rivendos me sukses' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};
