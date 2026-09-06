#!/usr/bin/env node
/**
 * Promote an existing user to admin, or create one.
 *
 * Promote:
 *   DATABASE_URL=postgresql://... node scripts/make-admin.js you@example.com
 *
 * Create (if email nuk ekziston):
 *   DATABASE_URL=... ADMIN_PASSWORD='StrongPass!' \
 *     node scripts/make-admin.js newadmin@example.com
 *
 * Optional: ADMIN_FIRST_NAME / ADMIN_LAST_NAME
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');

async function main() {
  const email = String(process.argv[2] || process.env.ADMIN_EMAIL || '')
    .trim()
    .toLowerCase();
  const password = process.argv[3] || process.env.ADMIN_PASSWORD || '';

  if (!email) {
    console.error('Usage: node scripts/make-admin.js <email> [password]');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const sequelize = require('../config/database');
  const User = require('../models/User');

  await sequelize.authenticate();

  let user = await User.findOne({ where: { email } });
  if (user) {
    user.role = 'admin';
    user.verified = true;
    if (password && String(password).length >= 8) {
      user.password = await bcrypt.hash(String(password), 10);
    }
    await user.save();
    console.log(
      `OK: promoted existing user to admin — id=${user.id} email=${user.email}` +
        (password ? ' (password updated)' : '')
    );
  } else {
    if (!password || String(password).length < 8) {
      console.error('User does not exist. Provide a password (min 8 chars) to create one.');
      process.exit(1);
    }
    const hash = await bcrypt.hash(String(password), 10);
    user = await User.create({
      email,
      password: hash,
      role: 'admin',
      verified: true,
      firstName: process.env.ADMIN_FIRST_NAME || 'System',
      lastName: process.env.ADMIN_LAST_NAME || 'Admin',
    });
    console.log(`OK: created admin — id=${user.id} email=${user.email}`);
  }

  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
