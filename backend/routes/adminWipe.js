/**
 * Route i përkohshëm për të mundësuar fshirjen e plotë të userave/mediave
 * pa pasur nevojë për Render Shell (i cili s'është i disponueshëm në planin Free).
 *
 * MBROJTJE: kërkohet header `x-wipe-secret` që të përputhet me env var
 * `WIPE_SECRET`. Nëse `WIPE_SECRET` s'është vendosur në environment,
 * endpoint-i refuzon çdo kërkesë (i çaktivizuar by default).
 *
 * PËRDORIM (nga browser ose curl):
 *   GET /api/admin-wipe/status?secret=<WIPE_SECRET>
 *     -> tregon sa userë ka (dry-run, s'fshin asgjë)
 *   POST /api/admin-wipe/run?secret=<WIPE_SECRET>&wipeMedia=true
 *     -> fshin realisht Users (CASCADE) dhe opsionalisht Cloudinary
 *
 * PAS PËRDORIMIT: hiq env var `WIPE_SECRET` nga Render (ose fshi këtë file)
 * për të mbyllur këtë "derë të pasme".
 */

const express = require('express');
const router = express.Router();
const sequelize = require('../config/database');

function checkSecret(req, res) {
  const expected = process.env.WIPE_SECRET;
  if (!expected) {
    res.status(403).json({ msg: 'WIPE_SECRET nuk është konfiguruar në environment. Endpoint i çaktivizuar.' });
    return false;
  }
  const provided = req.query.secret || req.headers['x-wipe-secret'];
  if (provided !== expected) {
    res.status(403).json({ msg: 'Secret i pasaktë.' });
    return false;
  }
  return true;
}

router.get('/status', async (req, res) => {
  if (!checkSecret(req, res)) return;
  try {
    const [[{ count }]] = await sequelize.query('SELECT COUNT(*)::int AS count FROM "Users";');
    res.json({ userCount: count, msg: 'Dry-run: asgjë s\'u fshi.' });
  } catch (err) {
    console.error('Wipe status error:', err);
    res.status(500).json({ msg: 'Gabim gjatë numërimit.', error: err.message });
  }
});

router.post('/run', async (req, res) => {
  if (!checkSecret(req, res)) return;

  const wipeMedia = req.query.wipeMedia === 'true' || req.body?.wipeMedia === true;

  try {
    const [[{ count }]] = await sequelize.query('SELECT COUNT(*)::int AS count FROM "Users";');

    await sequelize.query('TRUNCATE TABLE "Users" RESTART IDENTITY CASCADE;');

    let mediaResult = null;
    if (wipeMedia) {
      mediaResult = await wipeCloudinaryMedia();
    }

    res.json({
      msg: 'Platforma është tani bosh.',
      usersDeleted: count,
      mediaResult,
    });
  } catch (err) {
    console.error('Wipe run error:', err);
    let detail = err?.error?.message || err?.message || String(err);
    try {
      detail += ' | raw: ' + JSON.stringify(err);
    } catch (_) {}
    res.status(500).json({ msg: 'Gabim gjatë fshirjes.', error: detail });
  }
});

async function wipeCloudinaryMedia() {
  const hasCloudinaryConfig =
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET;

  if (!hasCloudinaryConfig) {
    return { skipped: true, reason: 'Cloudinary env vars mungojnë.' };
  }

  const cloudinary = require('../utils/cloudinary');
  const resourceTypes = ['image', 'video', 'raw'];
  const deletedCounts = {};

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

      // Cloudinary's delete_resources lejon max 100 public_ids për thirrje.
      const chunkSize = 100;
      for (let i = 0; i < publicIds.length; i += chunkSize) {
        const chunk = publicIds.slice(i, i + chunkSize);
        if (chunk.length > 0) {
          await cloudinary.api.delete_resources(chunk, { resource_type: resourceType });
          totalDeleted += chunk.length;
        }
      }

      nextCursor = result.next_cursor;
    } while (nextCursor);

    deletedCounts[resourceType] = totalDeleted;
  }

  return deletedCounts;
}

module.exports = router;
