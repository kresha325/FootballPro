'use strict';

const cloudinary = require('../utils/cloudinary');
const Profile = require('../models/Profile');
const Gallery = require('../models/Gallery');
const Video = require('../models/Video');
const Post = require('../models/Post');
const Stream = require('../models/Stream');
const LiveStreamReplay = require('../models/LiveStreamReplay');
const { publicCloudinaryAsset, authenticatedDeliveryUrl } = require('../utils/cloudinaryMediaDelivery');

/** Convert this user's legacy Cloudinary public assets to authenticated delivery
 * and update stored URLs. Safe to retry. Local uploads and already-authenticated
 * assets are left alone. This only runs after an explicit account-consent
 * withdrawal or account deletion; it does not change ordinary public media. */
async function restrictUserCloudinaryMedia(userId, options = {}) {
  if (!userId) return { secured: 0, skipped: 0, errors: [] };
  const dryRun = options.dryRun === true;
  const [profiles, galleries, videos, posts, streams, replays] = await Promise.all([
    Profile.findAll({ where: { userId } }),
    Gallery.findAll({ where: { userId } }),
    Video.findAll({ where: { userId } }),
    Post.findAll({ where: { userId } }),
    Stream.findAll({ where: { streamerId: userId } }),
    LiveStreamReplay.findAll({ where: { userId } }),
  ]);
  const records = [
    ...profiles.flatMap((row) => [{ row, key: 'profilePhoto' }, { row, key: 'coverPhoto' }]),
    ...galleries.flatMap((row) => [{ row, key: 'imageUrl' }, { row, key: 'videoUrl' }]),
    ...videos.flatMap((row) => [{ row, key: 'videoUrl' }, { row, key: 'thumbnailUrl' }]),
    ...posts.flatMap((row) => [
      { row, key: 'imageUrl', omitReferenceUpdate: true },
      { row, key: 'videoUrl', omitReferenceUpdate: true },
    ]),
    ...streams.flatMap((row) => [{ row, key: 'videoUrl' }, { row, key: 'thumbnailUrl' }]),
    ...replays.map((row) => ({ row, key: 'videoUrl' })),
  ];
  for (const row of profiles) {
    for (const entry of Array.isArray(row.liveVideos) ? row.liveVideos : []) {
      if (entry?.url) records.push({ row, key: 'liveVideos', entry });
    }
  }

  const urls = new Map();
  for (const item of records) {
    const value = item.entry ? item.entry.url : item.row[item.key];
    const asset = publicCloudinaryAsset(value);
    if (!asset) continue;
    const nextUrl = authenticatedDeliveryUrl(value);
    const key = `${asset.resourceType}:${asset.publicId}`;
    if (!urls.has(key)) urls.set(key, { asset, records: [] });
    urls.get(key).records.push({ ...item, value, nextUrl });
  }

  // Restrict API discovery before making external provider calls. A failed
  // Cloudinary operation must not leave controlled endpoints returning the
  // same URL as generally visible. Conversion below closes direct-URL access.
  for (const row of galleries) row.visibility = 'private';
  for (const row of videos) row.visibility = 'private';
  for (const row of streams) row.visibility = 'private';
  for (const row of profiles) row.liveVideos = [];
  for (const row of posts) { row.imageUrl = null; row.videoUrl = null; }
  for (const row of new Set([...galleries, ...videos, ...streams, ...profiles, ...posts])) await row.save();

  const errors = [];
  let secured = 0;
  for (const [assetKey, item] of urls) {
    try {
      if (!dryRun) {
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
          throw new Error('Cloudinary credentials are not configured');
        }
        await cloudinary.uploader.rename(item.asset.publicId, item.asset.publicId, {
          resource_type: item.asset.resourceType,
          type: 'upload',
          to_type: 'authenticated',
          invalidate: true,
        });
        for (const ref of item.records) {
          if (ref.omitReferenceUpdate) continue;
          if (ref.entry) {
            const liveVideos = Array.isArray(ref.row.liveVideos) ? [...ref.row.liveVideos] : [];
            const index = liveVideos.indexOf(ref.entry);
            if (index >= 0) liveVideos[index] = { ...liveVideos[index], url: ref.nextUrl };
            ref.row.liveVideos = liveVideos;
          } else {
            ref.row[ref.key] = ref.nextUrl;
          }
        }
        const rows = new Set(item.records.map((ref) => ref.row));
        for (const row of rows) await row.save();
      }
      secured += 1;
    } catch (error) {
      errors.push({ asset: assetKey, message: error?.message || 'Cloudinary conversion failed' });
    }
  }
  return { secured, skipped: records.length - [...urls.values()].reduce((n, item) => n + item.records.length, 0), errors };
}

module.exports = { restrictUserCloudinaryMedia };
