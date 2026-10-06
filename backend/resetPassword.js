/**
 * Development-only password reset.
 *
 * Usage:
 *   RESET_EMAIL=user@example.com RESET_PASSWORD='a-new-password' node resetPassword.js
 *
 * Refuses to run when NODE_ENV=production unless ALLOW_DESTRUCTIVE=true.
 * Never prints the password.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Sequelize } = require('sequelize');
const { assertDestructiveAllowed } = require('./utils/destructiveGuard');

assertDestructiveAllowed('resetPassword.js');

const email = String(process.env.RESET_EMAIL || '').trim();
const password = String(process.env.RESET_PASSWORD || '');

if (!email || password.length < 8) {
  console.error('Set RESET_EMAIL and RESET_PASSWORD (minimum 8 characters). The password is not printed.');
  process.exit(1);
}

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false,
  }
);

(async () => {
  try {
    const [results] = await sequelize.query(
      'SELECT id, email, role FROM "Users" WHERE LOWER(email) = LOWER(:email)',
      { replacements: { email } }
    );

    if (!results.length) {
      console.log('No user found for RESET_EMAIL');
      await sequelize.close();
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await sequelize.query(
      'UPDATE "Users" SET password = :password WHERE id = :id',
      { replacements: { password: hashedPassword, id: results[0].id } }
    );

    console.log('Password updated for user id', results[0].id);
    await sequelize.close();
  } catch (err) {
    console.error('Password reset failed:', err.message);
    process.exit(1);
  }
})();
