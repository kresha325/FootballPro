const auth = require('./auth');

const admin = (req, res, next) => {
  return auth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied. Admin role required.' });
    }
    return next();
  });
};

module.exports = admin;