const auth = require('./auth');

const admin = (req, res, next) => {
  auth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied. Admin role required.' });
    }
    next();
  });
};

module.exports = admin;