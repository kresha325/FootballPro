'use strict';

// Safe-by-default one-time backfill for legacy private/minor media.
// Run without --apply first. Public club logos and approved public content are
// outside this scan; only account-owned media governed by profile/visibility
// rules is considered.

function argValue(name, fallback) {
  const entry = process.argv.find((value) => value.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : fallback;
}

async function main() {
  const apply = process.argv.includes('--apply');
  if (apply && process.env.NODE_ENV === 'production' && process.env.CLOUDINARY_BACKFILL_ALLOW_PRODUCTION !== 'true') {
    throw new Error('Production apply requires CLOUDINARY_BACKFILL_ALLOW_PRODUCTION=true after reviewed approval.');
  }
  const limit = Math.max(1, Math.min(Number(argValue('--limit', '100')) || 100, 500));
  const afterUserId = Math.max(0, Number(argValue('--after-user-id', '0')) || 0);
  const db = require('../models');
  const sequelize = require('../config/database');
  const { Op } = require('sequelize');
  const { requiresAuthenticatedDelivery } = require('../utils/restrictedMedia');
  const { publicCloudinaryAsset } = require('../utils/cloudinaryMediaDelivery');
  const { restrictCloudinaryAsset, hasExplicitPublicReference } = require('../services/cloudinaryMediaJobs');

  const users = await db.User.findAll({
    where: { id: { [Op.gt]: afterUserId } },
    attributes: ['id'],
    order: [['id', 'ASC']],
    limit,
  });
  const userIds = users.map((user) => user.id);
  if (!userIds.length) {
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', scannedUsers: 0, uniqueAssets: 0, updatedReferences: 0, queuedRetries: 0 }));
    await sequelize.close();
    return;
  }

  const [profiles, galleries, videos, posts, streams, replays] = await Promise.all([
    db.Profile.findAll({ where: { userId: { [Op.in]: userIds } } }),
    db.Gallery.findAll({ where: { userId: { [Op.in]: userIds } } }),
    db.Video.findAll({ where: { userId: { [Op.in]: userIds } } }),
    db.Post.findAll({ where: { userId: { [Op.in]: userIds } } }),
    db.Stream.findAll({ where: { streamerId: { [Op.in]: userIds } } }),
    db.LiveStreamReplay.findAll({ where: { userId: { [Op.in]: userIds } } }),
  ]);
  const refs = [];
  for (const profile of profiles) {
    if (await requiresAuthenticatedDelivery(profile.userId, 'public')) {
      refs.push({ row: profile, key: 'profilePhoto' }, { row: profile, key: 'coverPhoto' });
    }
    const privacy = profile.privacy && typeof profile.privacy === 'object' ? profile.privacy : {};
    if (String(privacy.videos || 'public').toLowerCase() !== 'public') {
      for (const entry of Array.isArray(profile.liveVideos) ? profile.liveVideos : []) {
        if (entry?.url) refs.push({ row: profile, key: 'liveVideos', entry });
      }
    }
  }
  for (const row of galleries) {
    const video = ['video', 'highlight'].includes(String(row.type || '').toLowerCase()) || Boolean(row.videoUrl);
    if (await requiresAuthenticatedDelivery(row.userId, row.visibility, { kind: video ? 'video' : 'gallery' })) {
      refs.push({ row, key: 'imageUrl' }, { row, key: 'videoUrl' });
    }
  }
  for (const row of videos) {
    if (await requiresAuthenticatedDelivery(row.userId, row.visibility, { kind: 'video' })) refs.push({ row, key: 'videoUrl' }, { row, key: 'thumbnailUrl' });
  }
  for (const row of posts) {
    if (await requiresAuthenticatedDelivery(row.userId, 'public')) refs.push({ row, key: 'imageUrl' }, { row, key: 'videoUrl' });
  }
  for (const row of streams) {
    if (await requiresAuthenticatedDelivery(row.streamerId, row.visibility)) refs.push({ row, key: 'videoUrl' }, { row, key: 'thumbnailUrl' });
  }
  for (const row of replays) {
    if (await requiresAuthenticatedDelivery(row.userId, 'public')) refs.push({ row, key: 'videoUrl' });
  }

  const assets = new Map();
  for (const ref of refs) {
    const url = ref.entry ? ref.entry.url : ref.row[ref.key];
    const asset = publicCloudinaryAsset(url);
    if (!asset) continue;
    const assetKey = `${asset.resourceType}:${asset.publicId}`;
    if (!assets.has(assetKey)) assets.set(assetKey, { asset, refs: [] });
    assets.get(assetKey).refs.push({ ...ref, url });
  }

  let updatedReferences = 0;
  let queuedRetries = 0;
  if (apply) {
    for (const group of assets.values()) {
      let publicReference = false;
      for (const ref of group.refs) {
        const ownerId = ref.row.userId || ref.row.streamerId;
        if (await hasExplicitPublicReference(ownerId, ref.url)) {
          publicReference = true;
          break;
        }
      }
      const result = publicReference
        ? { restrictedUrl: group.refs[0].url, preservedPublicReference: true }
        : await restrictCloudinaryAsset(group.refs[0].url, { reason: 'legacy_privacy_backfill' });
      if (result.queued) queuedRetries += 1;
      for (const ref of group.refs) {
        if (ref.entry) {
          const videosList = Array.isArray(ref.row.liveVideos) ? [...ref.row.liveVideos] : [];
          const index = videosList.indexOf(ref.entry);
          if (index >= 0) videosList[index] = { ...videosList[index], url: result.restrictedUrl };
          ref.row.liveVideos = videosList;
        } else ref.row[ref.key] = result.restrictedUrl;
        updatedReferences += 1;
      }
      const rows = new Set(group.refs.map((ref) => ref.row));
      for (const row of rows) await row.save();
    }
  }
  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    scannedUsers: userIds.length,
    lastUserId: userIds[userIds.length - 1],
    uniqueAssets: assets.size,
    updatedReferences,
    queuedRetries,
  }));
  await sequelize.close();
}

main().catch((error) => {
  console.error(`Cloudinary media backfill failed: ${error?.message || error}`);
  process.exitCode = 1;
});
