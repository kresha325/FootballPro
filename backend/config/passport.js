const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const AppleStrategy = require('@nicokaiser/passport-apple').Strategy;
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function randomUnusablePassword() {
  const raw = crypto.randomBytes(32).toString('hex');
  return bcrypt.hash(raw, 10);
}

/**
 * Link or create user from OAuth profile.
 * @param {'googleId'|'facebookId'|'appleId'} idField
 */
async function upsertOAuthUser(idField, profileId, email, firstName, lastName) {
  if (!profileId) throw new Error('OAuth profile id mungon');

  let user = await User.findOne({ where: { [idField]: profileId } });
  if (user) return user;

  const normalizedEmail = email ? String(email).trim().toLowerCase() : '';
  if (normalizedEmail) {
    user = await User.findOne({ where: { email: normalizedEmail } });
    if (user) {
      user[idField] = profileId;
      await user.save();
      return user;
    }
  }

  if (!normalizedEmail) {
    // Apple may omit email on later logins — without prior appleId row we cannot create safely
    throw new Error(
      'Email nuk u dha nga ofruesi. Hyr një herë me email të dukshëm, ose lidh llogarinë ekzistuese.'
    );
  }

  return User.create({
    [idField]: profileId,
    email: normalizedEmail,
    firstName: firstName || 'User',
    lastName: lastName || '',
    role: 'athlete',
    password: await randomUnusablePassword(),
  });
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const user = await upsertOAuthUser(
            'googleId',
            profile.id,
            email,
            profile.name?.givenName,
            profile.name?.familyName
          );
          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
}

if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: '/api/auth/facebook/callback',
        profileFields: ['id', 'emails', 'name'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const user = await upsertOAuthUser(
            'facebookId',
            profile.id,
            email,
            profile.name?.givenName,
            profile.name?.familyName
          );
          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
}

function applePrivateKey() {
  const raw = process.env.APPLE_PRIVATE_KEY || '';
  if (raw.trim()) {
    return raw.replace(/\\n/g, '\n');
  }
  return null;
}

function appleConfigured() {
  return !!(
    process.env.APPLE_CLIENT_ID &&
    process.env.APPLE_TEAM_ID &&
    process.env.APPLE_KEY_ID &&
    applePrivateKey()
  );
}

function appleCallbackURL() {
  if (process.env.APPLE_CALLBACK_URL) {
    return String(process.env.APPLE_CALLBACK_URL).trim();
  }
  const origin = (
    process.env.BACKEND_PUBLIC_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    'https://footballpro.onrender.com'
  ).replace(/\/$/, '');
  return `${origin}/api/auth/apple/callback`;
}

if (appleConfigured()) {
  passport.use(
    new AppleStrategy(
      {
        clientID: process.env.APPLE_CLIENT_ID,
        teamID: process.env.APPLE_TEAM_ID,
        keyID: process.env.APPLE_KEY_ID,
        key: applePrivateKey(),
        scope: ['name', 'email'],
        callbackURL: appleCallbackURL(),
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const firstName = profile.name?.firstName || profile.name?.givenName || '';
          const lastName = profile.name?.lastName || profile.name?.familyName || '';
          const user = await upsertOAuthUser(
            'appleId',
            profile.id,
            profile.email,
            firstName,
            lastName
          );
          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
}

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
module.exports.appleConfigured = appleConfigured;
module.exports.appleCallbackURL = appleCallbackURL;
