const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

function currentLevel() {
  const name = String(process.env.LOG_LEVEL || 'info').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(LEVELS, name) ? LEVELS[name] : LEVELS.info;
}

function enabled(level) {
  if (process.env.NODE_ENV === 'test') return false;
  return LEVELS[level] <= currentLevel();
}

function write(level, args) {
  if (!enabled(level)) return;
  const sink = level === 'error' || level === 'warn' ? console[level] : console.log;
  sink(...args);
}

const logger = {
  error: (...args) => write('error', args),
  warn: (...args) => write('warn', args),
  info: (...args) => write('info', args),
  debug: (...args) => write('debug', args),
};

module.exports = logger;
