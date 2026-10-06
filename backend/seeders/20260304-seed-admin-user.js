const bcrypt = require('bcryptjs');

/**
 * Optional local bootstrap admin.
 * Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD in the environment.
 * No password is stored in source. Skipped in production unless ALLOW_ADMIN_BOOTSTRAP=true.
 */
module.exports = {
  up: async (queryInterface) => {
    const email = String(process.env.ADMIN_BOOTSTRAP_EMAIL || '').trim().toLowerCase();
    const password = String(process.env.ADMIN_BOOTSTRAP_PASSWORD || '');
    if (!email || password.length < 8) {
      console.warn('Skipping admin bootstrap. Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD (min 8 chars).');
      return;
    }
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_ADMIN_BOOTSTRAP !== 'true') {
      console.warn('Skipping admin bootstrap in production.');
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await queryInterface.bulkInsert('Users', [
      {
        id: 10001,
        email,
        password: passwordHash,
        role: 'admin',
        verified: true,
        firstName: 'System',
        lastName: 'Admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ], {});
  },

  down: async (queryInterface) => {
    const email = String(process.env.ADMIN_BOOTSTRAP_EMAIL || '').trim().toLowerCase();
    if (!email) return;
    await queryInterface.bulkDelete('Users', { email }, {});
  },
};
