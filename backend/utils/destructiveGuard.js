const logger = require('./logger');
/**
 * Stop maintenance scripts from running against production by accident.
 * Set ALLOW_DESTRUCTIVE=true only for an intentional maintenance window.
 */
function assertDestructiveAllowed(scriptName) {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DESTRUCTIVE !== 'true') {
    logger.error(
      `${scriptName} refused: NODE_ENV=production. Set ALLOW_DESTRUCTIVE=true only for an intentional maintenance window.`
    );
    process.exit(1);
  }
}

module.exports = { assertDestructiveAllowed };
