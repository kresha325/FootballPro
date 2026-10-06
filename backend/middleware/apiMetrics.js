'use strict';

const { recordRequest, normalizePath } = require('../services/admin/metrics');

function apiMetrics(req, res, next) {
  if (!req.originalUrl || !req.originalUrl.startsWith('/api')) return next();
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    recordRequest({
      method: req.method,
      path: normalizePath(req.route?.path ? `${req.baseUrl || ''}${req.route.path}` : req.path),
      status: res.statusCode,
      durationMs,
    });
  });
  return next();
}

module.exports = apiMetrics;
