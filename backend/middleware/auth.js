const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getJwtSecret } = require('../utils/jwtSecret');
const {
  persistReconcileIfNeeded,
  buildAccessPayload,
  getEffectiveTier,
} = require('../utils/subscriptionAccess');

const USER_AUTH_ATTRS = [
  'id',
  'role',
  'firstName',
  'lastName',
  'email',
  'premium',
  'premiumExpiresAt',
  'subscriptionPlan',
  'verified',
  'bannedAt',
  'deletedAt',
  'createdAt',
];

const USER_AUTH_EXTRA = ['adminRole', 'tokenVersion'];

async function findAuthUser(userId) {
  try {
    return await User.findByPk(userId, { attributes: [...USER_AUTH_ATTRS, ...USER_AUTH_EXTRA] });
  } catch (err) {
    if (!/adminRole|tokenVersion|column/i.test(String(err?.message || ''))) throw err;
    return User.findByPk(userId, { attributes: USER_AUTH_ATTRS });
  }
}

async function attachUser(req, userId) {
  const dbUser = await findAuthUser(userId);
  if (!dbUser) return null;
  if (dbUser.deletedAt || dbUser.bannedAt) return dbUser;
  await persistReconcileIfNeeded(dbUser);
  const plain = dbUser.get({ plain: true });
  const access = buildAccessPayload(plain);
  return {
    ...plain,
    premium: access.premium,
    effectiveTier: access.effectiveTier,
    access,
  };
}

const auth = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ msg: 'Nuk ka token, autorizimi u refuzua' });
  }

  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret);
    const userId = decoded?.user?.id;

    if (!userId) {
      return res.status(401).json({ msg: 'Tokeni nuk është i vlefshëm' });
    }

    const dbUser = await findAuthUser(userId);

    if (!dbUser) {
      return res.status(401).json({ msg: 'Përdoruesi nuk u gjet' });
    }

    const tokenVersion = Number(dbUser.tokenVersion || 0);
    const claimedVersion = Number(decoded?.user?.tv || 0);
    if (tokenVersion > 0 && claimedVersion !== tokenVersion) {
      return res.status(401).json({ msg: 'Sesioni është mbyllur. Hyni përsëri.' });
    }

    if (dbUser.deletedAt) {
      return res.status(403).json({ msg: 'Llogaria është e fshirë' });
    }
    if (dbUser.bannedAt) {
      return res.status(403).json({ msg: 'Llogaria është e pezulluar' });
    }

    await persistReconcileIfNeeded(dbUser);
    const plain = dbUser.get({ plain: true });
    const access = buildAccessPayload(plain);
    req.user = {
      ...plain,
      premium: access.premium,
      effectiveTier: access.effectiveTier,
      access,
    };
    next();
  } catch (err) {
    console.error('AUTH token verification failed:', err.message);
    if (err?.message === 'JWT_SECRET is required in production') {
      return res.status(500).json({ msg: 'Gabim konfigurimi i serverit' });
    }
    res.status(401).json({ msg: 'Tokeni nuk është i vlefshëm' });
  }
};

module.exports = auth;
module.exports.protect = auth;
module.exports.getEffectiveTier = getEffectiveTier;
module.exports.attachUser = attachUser;

/** Attach req.user when a valid Bearer token is present; never fail the request. */
module.exports.optionalAuth = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return next();
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret);
    const userId = decoded?.user?.id;
    if (!userId) return next();
    const attached = await attachUser(req, userId);
    if (attached && !attached.deletedAt && !attached.bannedAt) {
      req.user = attached;
    }
  } catch (_) {
    /* ignore invalid token for optional auth */
  }
  return next();
};
