'use strict';

const bcrypt = require('bcryptjs');

const ADMIN_EMAIL = 'kresha325@gmail.com';

module.exports = {
  up: async (queryInterface) => {
    const passwordHash = await bcrypt.hash('kresha325gashi', 10);
    const [rows] = await queryInterface.sequelize.query(
      `SELECT id FROM "Users" WHERE lower(email) = lower(:email) LIMIT 1`,
      { replacements: { email: ADMIN_EMAIL } }
    );

    if (rows && rows.length) {
      await queryInterface.sequelize.query(
        `UPDATE "Users"
         SET role = 'admin',
             verified = true,
             password = :passwordHash,
             "updatedAt" = NOW()
         WHERE id = :id`,
        { replacements: { passwordHash, id: rows[0].id } }
      );
      return;
    }

    await queryInterface.bulkInsert('Users', [
      {
        email: ADMIN_EMAIL,
        password: passwordHash,
        role: 'admin',
        verified: true,
        premium: false,
        firstName: 'Kresha',
        lastName: 'Admin',
        joncoinBalance: 0,
        points: 0,
        level: 1,
        experience: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `UPDATE "Users"
       SET role = 'athlete', "updatedAt" = NOW()
       WHERE lower(email) = lower(:email) AND role = 'admin'`,
      { replacements: { email: ADMIN_EMAIL } }
    );
  },
};
