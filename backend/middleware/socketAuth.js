const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../utils/jwtSecret');

/**
 * Socket.IO middleware.
 * - With valid JWT: sets socket.userId from token (never from client uid).
 * - Without token: allows anonymous connection for public events only
 *   (e.g. subscribe:streams). Privileged handlers must check socket.userId.
 */
async function socketAuth(socket, next) {
  try {
    const auth = socket.handshake?.auth || {};
    const header = socket.handshake?.headers?.authorization || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const token = String(auth.token || auth.accessToken || bearer || '').trim();

    socket.data = socket.data || {};

    if (!token) {
      socket.userId = null;
      socket.data.userId = null;
      socket.data.anonymous = true;
      return next();
    }

    const decoded = jwt.verify(token, getJwtSecret());
    const userId = decoded?.user?.id;
    if (!userId) {
      return next(new Error('Unauthorized'));
    }

    socket.userId = String(userId);
    socket.data.userId = userId;
    socket.data.anonymous = false;
    return next();
  } catch (_err) {
    return next(new Error('Unauthorized'));
  }
}

module.exports = socketAuth;
