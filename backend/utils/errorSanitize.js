const INTERNAL_HINT = /sequelize|syntax error|node_modules|\/users\/|\b(select|insert|update|delete)\b|password|secret|econnrefused|\bsql\b/i;

function sanitizeErrorBody(body, statusCode, env = process.env) {
  if (env.NODE_ENV !== 'production') return body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  if (statusCode < 500) return body;

  const safe = { ...body };
  delete safe.stack;
  delete safe.sql;
  delete safe.parent;
  delete safe.original;
  delete safe.details;

  if (safe.error != null) {
    const text = typeof safe.error === 'string' ? safe.error : '';
    if (!text || INTERNAL_HINT.test(text)) delete safe.error;
  }
  if (typeof safe.msg === 'string' && INTERNAL_HINT.test(safe.msg)) {
    safe.msg = 'Server error';
  }
  if (typeof safe.error === 'string' && safe.error.length > 200) {
    delete safe.error;
  }
  return safe;
}

function installErrorSanitizer(app) {
  app.use((req, res, next) => {
    const orig = res.json.bind(res);
    res.json = (body) => orig(sanitizeErrorBody(body, res.statusCode));
    next();
  });
}

module.exports = { sanitizeErrorBody, installErrorSanitizer };
