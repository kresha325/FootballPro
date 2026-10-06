'use strict';

const { optionalAuth } = require('./auth');
const { isFeatureEnabled } = require('../services/admin/settings');
const { featureDecision } = require('../services/admin/policy');

function requireFeature(flag) {
  return async (req, res, next) => {
    try {
      const enabled = await isFeatureEnabled(flag);
      if (enabled) return next();
      if (!req.user && req.header('Authorization')) {
        await new Promise((resolve) => {
          optionalAuth(req, res, resolve);
        });
      }
      const decision = featureDecision({ enabled, user: req.user });
      if (decision.allow) return next();
      return res.status(decision.status).json({ ...decision.body, flag });
    } catch (err) {
      console.warn('feature flag:', err?.message || err);
      return next();
    }
  };
}

module.exports = { requireFeature };
