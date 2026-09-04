/**
 * Skript për të fshirë ABSOLUTISHT çdo user dhe të dhënat e lidhura me ta,
 * duke lënë platformën bosh (empty state). Opsionalisht fshin edhe të gjitha
 * asetet e ngarkuara në Cloudinary (foto profili, foto/video postimesh, etj.).
 *
 * PËRDORIM (nga Render Shell, brenda direktorisë backend/):
 *   node scripts/wipeAllUsers.js                       -> dry-run (vetëm numëron)
 *   node scripts/wipeAllUsers.js --confirm              -> fshin databazën
 *   node scripts/wipeAllUsers.js --confirm --wipe-media -> fshin databazën + Cloudinary
 *
 * Pa flag-un --confirm, skripti vetëm tregon sa userë do të fshihen (dry-run).
 */

require('dotenv').config();
const sequelize = require('../config/database');

async function wipeCloudinaryMedia() {
  const hasCloudinaryConfig =
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET;

  if (!hasCloudinaryConfig) {
    console.log('Cloudinary s\'është konfiguruar (env vars mungojnë) — po e kapërcej pastrimin e mediave.');
    return;
  }

  const cloudinary = require('../utils/cloudinary');

  console.log('Duke fshirë asetet nga Cloudinary...');

  // Cloudinary grupon resurset sipas "resource_type" (image, video, raw).
  const resourceTypes = ['image', 'video', 'raw'];

  for (const resourceType of resourceTypes) {
    let nextCursor = undefined;
    let totalDeleted = 0;

    do {
      const result = await cloudinary.api.resources({
        resource_type: resourceType,
        max_results: 500,
        next_cursor: nextCursor,
      });

      const publicIds = result.resources.map((r) => r.public_id);

      if (publicIds.length > 0) {
        await cloudinary.api.delete_resources(publicIds, { resource_type: resourceType });
        totalDeleted += publicIds.length;
      }

      nextCursor = result.next_cursor;
    } while (nextCursor);

    console.log(`  - ${resourceType}: ${totalDeleted} asete fshirë.`);
  }

  console.log('Pastrimi i Cloudinary u krye.');
}

async function main() {
  const confirm = process.argv.includes('--confirm');
  const wipeMedia = process.argv.includes('--wipe-media');

  const [[{ count }]] = await sequelize.query('SELECT COUNT(*)::int AS count FROM "Users";');
  console.log(`Gjetur ${count} userë në databazë.`);

  if (!confirm) {
    console.log('Dry-run: asgjë s\'u fshi. Rendit skriptin me --confirm për të fshirë realisht.');
    if (wipeMedia) {
      console.log('(--wipe-media do të fshijë edhe Cloudinary kur të përdorësh --confirm.)');
    }
    await sequelize.close();
    return;
  }

  console.log('Duke fshirë "Users" me CASCADE (kjo do fshijë automatikisht çdo rresht të varur nëpërmjet foreign keys)...');
  // TRUNCATE ... CASCADE fshin edhe rreshtat në tabela të tjera që referojnë Users
  // përmes foreign key constraints (profiles, posts, comments, likes, messages, etj.)
  await sequelize.query('TRUNCATE TABLE "Users" RESTART IDENTITY CASCADE;');

  console.log('U krye. Platforma është tani bosh (0 userë) në databazë.');

  if (wipeMedia) {
    await wipeCloudinaryMedia();
  } else {
    console.log('(Media e Cloudinary s\'u prek. Përdor --wipe-media për ta fshirë edhe atë.)');
  }

  await sequelize.close();
}

main().catch(async (err) => {
  console.error('Gabim gjatë fshirjes:', err);
  await sequelize.close();
  process.exit(1);
});
