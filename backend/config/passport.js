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

function backendPublicOrigin() {
  // Prefer explicit backend host. Avoid PUBLIC_BASE_URL if it points at the SPA.
  const candidates = [
    process.env.BACKEND_PUBLIC_URL,
    process.env.RENDER_EXTERNAL_URL,
    process.env.PUBLIC_BASE_URL,
  ];
  for (const raw of candidates) {
    const v = String(raw || '').trim().replace(/\/$/, '');
    if (!v) continue;
    if (/xtalenti\.com/i.test(v)) continue; // frontend host — not OAuth callback host
    return v.replace(/\/api$/i, '');
  }
  return 'https://footballpro.onrender.com';
}

function googleCallbackURL() {
  if (process.env.GOOGLE_CALLBACK_URL) return String(process.env.GOOGLE_CALLBACK_URL).trim();
  return `${backendPublicOrigin()}/api/auth/google/callback`;
}

function facebookCallbackURL() {
  if (process.env.FACEBOOK_CALLBACK_URL) return String(process.env.FACEBOOK_CALLBACK_URL).trim();
  return `${backendPublicOrigin()}/api/auth/facebook/callback`;
}

/**
 * Link or create user from OAuth profile.
 * @param {'googleId'|'facebookId'|'appleId'} idField
 */
async function upsertOAuthUser(idField, profileId, email, firstName, lastName) {
  if (!profileId) throw new Error('OAuth profile id mungon');

  let user = await User.findOne({ where: { [idField]: profileId } });
  if (user) return user;

  let normalizedEmail = email ? String(email).trim().toLowerCase() : '';
  // Facebook sometimes omits email — still create a usable account
  if (!normalizedEmail && idField === 'facebookId') {
    normalizedEmail = `fb_${profileId}@users.xtalenti.local`;
  }

  if (normalizedEmail) {
    user = await User.findOne({ where: { email: normalizedEmail } });
    if (user) {
      user[idField] = profileId;
      await user.save();
      return user;
    }
  }

  if (!normalizedEmail) {
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
        callbackURL: googleCallbackURL(),
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
        callbackURL: facebookCallbackURL(),
        profileFields: ['id', 'emails', 'name', 'displayName'],
        enableProof: true,
        graphAPIVersion: 'v21.0',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value || null;
          const first =
            profile.name?.givenName ||
            (profile.displayName ? String(profile.displayName).split(' ')[0] : '') ||
            'User';
          const last =
            profile.name?.familyName ||
            (profile.displayName ? String(profile.displayName).split(' ').slice(1).join(' ') : '');
          const user = await upsertOAuthUser('facebookId', profile.id, email, first, last);
          return done(null, user);
        } catch (err) {
          console.error('Facebook OAuth upsert failed:', err?.message || err);
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
  return `${backendPublicOrigin()}/api/auth/apple/callback`;
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
module.exports.facebookCallbackURL = facebookCallbackURL;
module.exports.googleCallbackURL = googleCallbackURL;
