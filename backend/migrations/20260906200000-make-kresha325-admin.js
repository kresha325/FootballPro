'use strict';

/**
 * Filename kept so databases that already applied this migration are not asked
 * to run it again. The previous revision hashed a password that was committed
 * to the repository and could reset that account on a fresh install.
 * This revision does not create an account and does not change a password.
 * Bootstrap an administrator with ADMIN_BOOTSTRAP_EMAIL and
 * ADMIN_BOOTSTRAP_PASSWORD outside source control, and rotate any password
 * that the previous revision already wrote.
 */
module.exports = {
  up: async () => {},

  down: async () => {},
};
