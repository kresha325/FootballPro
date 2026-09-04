/**
 * Skript për të fshirë ABSOLUTISHT çdo user dhe të dhënat e lidhura me ta,
 * duke lënë platformën bosh (empty state).
 *
 * PËRDORIM (nga Render Shell, brenda direktorisë backend/):
 *   node scripts/wipeAllUsers.js --confirm
 *
 * Pa flag-un --confirm, skripti vetëm tregon sa userë do të fshihen (dry-run).
 */

require('dotenv').config();
const sequelize = require('../config/database');

async function main() {
  const confirm = process.argv.includes('--confirm');

  const [[{ count }]] = await sequelize.query('SELECT COUNT(*)::int AS count FROM "Users";');
  console.log(`Gjetur ${count} userë në databazë.`);

  if (!confirm) {
    console.log('Dry-run: asgjë s\'u fshi. Rendit skriptin me --confirm për të fshirë realisht.');
    await sequelize.close();
    return;
  }

  console.log('Duke fshirë "Users" me CASCADE (kjo do fshijë automatikisht çdo rresht të varur nëpërmjet foreign keys)...');
  // TRUNCATE ... CASCADE fshin edhe rreshtat në tabela të tjera që referojnë Users
  // përmes foreign key constraints (profiles, posts, comments, likes, messages, etj.)
  await sequelize.query('TRUNCATE TABLE "Users" RESTART IDENTITY CASCADE;');

  console.log('U krye. Platforma është tani bosh (0 userë).');
  await sequelize.close();
}

main().catch(async (err) => {
  console.error('Gabim gjatë fshirjes:', err);
  await sequelize.close();
  process.exit(1);
});
