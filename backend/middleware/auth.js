const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getJwtSecret } = require('../utils/jwtSecret');

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

    const dbUser = await User.findByPk(userId, {
      attributes: [
        'id',
        'role',
        'firstName',
        'lastName',
        'email',
        'premium',
        'verified',
        'bannedAt',
        'deletedAt',
      ],
    });

    if (!dbUser) {
      return res.status(401).json({ msg: 'Përdoruesi nuk u gjet' });
    }

    if (dbUser.deletedAt) {
      return res.status(403).json({ msg: 'Llogaria është e fshirë' });
    }
    if (dbUser.bannedAt) {
      return res.status(403).json({ msg: 'Llogaria është e pezulluar' });
    }

    req.user = dbUser.get({ plain: true });
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
