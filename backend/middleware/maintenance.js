'use strict';

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getJwtSecret } = require('../utils/jwtSecret');
const { getMaintenance } = require('../services/admin/settings');
const { maintenanceDecision } = require('../services/admin/policy');

async function actorFromRequest(req) {
  if (req.user?.role) return req.user;
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const userId = decoded?.user?.id;
    if (!userId) return null;
    return User.findByPk(userId, { attributes: ['id', 'role', 'bannedAt', 'deletedAt'] });
  } catch (_err) {
    return null;
  }
}

async function maintenanceGate(req, res, next) {
  if (!req.originalUrl || !req.originalUrl.startsWith('/api')) return next();
  try {
    const maintenance = await getMaintenance();
    if (!maintenance.enabled) return next();
    const user = await actorFromRequest(req);
    const decision = maintenanceDecision({
      maintenance,
      user,
      path: req.originalUrl.split('?')[0],
    });
    if (decision.allow) return next();
    return res.status(decision.status).json(decision.body);
  } catch (err) {
    console.warn('maintenance gate:', err?.message || err);
    return next();
  }
}

module.exports = maintenanceGate;
