const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    console.log('❌ AUTH: No token provided');
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ AUTH: Token decoded:', decoded);
    req.user = decoded.user;
    next();
  } catch (err) {
    console.error('❌ AUTH: Token verification failed:', err.message);
    res.status(401).json({ msg: 'Token is not valid' });
  }
};

// Export both named and default
module.exports = auth;
module.exports.protect = auth;