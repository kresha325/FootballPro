'use strict';

// Inventory/restrict legacy private media. Default mode is read-only; --apply
// makes external Cloudinary and database changes. Never run this as part of
// app startup or a migration.
const cloudinary = require('../utils/cloudinary');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Gallery = require('../models/Gallery');
const Video = require('../models/Video');
const Post = require('../models/Post');
const Stream = require('../models/Stream');
const LiveStreamReplay = require('../models/LiveStreamReplay');
const sequelize = require('../config/database');
const { publicCloudinaryAsset, authenticatedDeliveryUrl } = require('../utils/cloudinaryMediaDelivery');
const { requiresParentalAuthorization } = require('../utils/parentalAuthorization');
const { ageFromDateOnly } = require('../utils/registerValidation');

async function main() {
  const apply = process.argv.includes('--apply');
  if (apply && process.env.NODE_ENV === 'production' && process.env.CONFIRM_PRODUCTION_MEDIA_BACKFILL !== 'YES') {
    throw new Error('Production apply requires CONFIRM_PRODUCTION_MEDIA_BACKFILL=YES after the dry-run is reviewed.');
  }
  if (apply && (!process.env.CLOUDINARY_API_SECRET || !process.env.CLOUDINARY_CLOUD_NAME)) {
    throw new Error('Cloudinary credentials are required for --apply.');
  }
  await sequelize.authenticate();
  const refs = [];
  const add = (row, field, entry = null) => {
    const currentUrl = entry ? entry.url : row[field];
    const asset = publicCloudinaryAsset(currentUrl);
    if (asset) refs.push({ row, field, entry, currentUrl, nextUrl: authenticatedDeliveryUrl(currentUrl), asset });
  };

  const [privateGallery, restrictedVideos, privateStreams] = await Promise.all([
    Gallery.findAll({ where: { visibility: ['followers', 'private'] } }),
    Video.findAll({ where: { visibility: ['private', 'unlisted'] } }),
    Stream.findAll({ where: { visibility: 'private' } }),
  ]);
  for (const row of privateGallery) { add(row, 'imageUrl'); add(row, 'videoUrl'); }
  for (const row of restrictedVideos) { add(row, 'videoUrl'); add(row, 'thumbnailUrl'); }
  for (const row of privateStreams) { add(row, 'videoUrl'); add(row, 'thumbnailUrl'); }

  const minors = await User.findAll({ where: { role: 'athlete', deletedAt: null } });
  for (const user of minors) {
    // Unknown/invalid DOB cannot establish adulthood safely. Keep these
    // legacy athlete assets restricted until age is corrected and verified.
    const age = user.dateOfBirth ? ageFromDateOnly(user.dateOfBirth) : Number.NaN;
    if (Number.isFinite(age) && age >= 18 && !await requiresParentalAuthorization(user)) continue;
    const [profiles, galleries, videos, posts, streams, replays] = await Promise.all([
      Profile.findAll({ where: { userId: user.id } }), Gallery.findAll({ where: { userId: user.id } }),
      Video.findAll({ where: { userId: user.id } }), Post.findAll({ where: { userId: user.id } }),
      Stream.findAll({ where: { streamerId: user.id } }), LiveStreamReplay.findAll({ where: { userId: user.id } }),
    ]);
    for (const row of profiles) { add(row, 'profilePhoto'); add(row, 'coverPhoto'); }
    for (const row of galleries) { add(row, 'imageUrl'); add(row, 'videoUrl'); }
    for (const row of videos) { add(row, 'videoUrl'); add(row, 'thumbnailUrl'); }
    for (const row of posts) { add(row, 'imageUrl'); add(row, 'videoUrl'); }
    for (const row of streams) {
      add(row, 'videoUrl'); add(row, 'thumbnailUrl');
      for (const entry of Array.isArray(row.liveVideos) ? row.liveVideos : []) add(row, 'liveVideos', entry);
    }
    for (const row of replays) add(row, 'videoUrl');
  }

  const unique = new Map();
  for (const ref of refs) {
    const key = `${ref.asset.resourceType}:${ref.asset.publicId}`;
    if (!unique.has(key)) unique.set(key, { asset: ref.asset, refs: [] });
    unique.get(key).refs.push(ref);
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', uniqueAssets: unique.size, dbReferences: refs.length,
    sample: [...unique.entries()].slice(0, 30).map(([asset, value]) => ({ asset, references: value.refs.length })) }, null, 2));
  if (!apply) return;

  let converted = 0;
  const failures = [];
  for (const [key, item] of unique) {
    try {
      await cloudinary.uploader.rename(item.asset.publicId, item.asset.publicId, {
        resource_type: item.asset.resourceType, type: 'upload', to_type: 'authenticated', invalidate: true,
      });
      for (const ref of item.refs) {
        if (ref.entry) {
          const liveVideos = Array.isArray(ref.row.liveVideos) ? [...ref.row.liveVideos] : [];
          const index = liveVideos.indexOf(ref.entry);
          if (index >= 0) liveVideos[index] = { ...liveVideos[index], url: ref.nextUrl };
          ref.row.liveVideos = liveVideos;
        } else ref.row[ref.field] = ref.nextUrl;
      }
      for (const row of new Set(item.refs.map((ref) => ref.row))) await row.save();
      converted += 1;
    } catch (error) {
      failures.push({ asset: key, message: error?.message || 'conversion failed' });
    }
  }
  console.log(JSON.stringify({ converted, failures }, null, 2));
  if (failures.length) process.exitCode = 2;
}

main().catch((error) => { console.error(error.message || error); process.exitCode = 1; })
  .finally(async () => { await sequelize.close(); });
