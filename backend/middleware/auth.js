const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'dev_jwt_secret';
    const decoded = jwt.verify(token, secret);
    const userId = decoded?.user?.id;

    if (!userId) {
      return res.status(401).json({ msg: 'Token is not valid' });
    }

    const dbUser = await User.findByPk(userId, {
      attributes: ['id', 'role', 'firstName', 'lastName', 'email', 'premium', 'verified'],
    });

    if (!dbUser) {
      return res.status(401).json({ msg: 'User not found' });
    }

    req.user = dbUser.get({ plain: true });
    next();
  } catch (err) {
    console.error('AUTH token verification failed:', err.message);
    res.status(401).json({ msg: 'Token is not valid' });
  }
};

module.exports = auth;
module.exports.protect = auth;
