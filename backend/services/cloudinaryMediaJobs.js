'use strict';

const cloudinary = require('../utils/cloudinary');
const CloudinaryMediaJob = require('../models/CloudinaryMediaJob');
const { publicCloudinaryAsset } = require('../utils/cloudinaryMediaDelivery');

function safeError(error) {
  return String(error?.message || 'Cloudinary operation failed').slice(0, 500);
}

async function enqueueCloudinaryMediaJob({ asset, reason, fromType = 'upload', toType = 'authenticated' }) {
  if (!asset?.publicId || !asset?.resourceType) return null;
  const where = { resourceType: asset.resourceType, publicId: asset.publicId, toType };
  const existing = await CloudinaryMediaJob.findOne({ where });
  if (existing) {
    await existing.update({ fromType, reason, status: 'pending', nextAttemptAt: new Date(), lastError: null });
    return existing;
  }
  try {
    return await CloudinaryMediaJob.create({ ...where, fromType, reason, status: 'pending', nextAttemptAt: new Date() });
  } catch (error) {
    if (error.name !== 'SequelizeUniqueConstraintError') throw error;
    const raced = await CloudinaryMediaJob.findOne({ where });
    if (raced) await raced.update({ fromType, reason, status: 'pending', nextAttemptAt: new Date() });
    return raced;
  }
}

async function hasExplicitPublicReference(userId, url, { excludeGalleryId, ignoreGallery = false, ignoreVideos = false } = {}) {
  if (!url) return false;
  const { Op } = require('sequelize');
  const [profiles, posts, videos, streams, galleries] = await Promise.all([
    require('../models/Profile').findAll({ where: { [Op.or]: [{ profilePhoto: url }, { coverPhoto: url }] }, attributes: ['userId'] }),
    require('../models/Post').findAll({ where: { [Op.or]: [{ imageUrl: url }, { videoUrl: url }] }, attributes: ['userId'] }),
    require('../models/Video').findAll({ where: { visibility: 'public', [Op.or]: [{ videoUrl: url }, { thumbnailUrl: url }] }, attributes: ['userId'] }),
    require('../models/Stream').findAll({ where: { visibility: 'public', [Op.or]: [{ videoUrl: url }, { thumbnailUrl: url }] }, attributes: ['streamerId'] }),
    require('../models/Gallery').findAll({
      where: { visibility: 'public', ...(excludeGalleryId ? { id: { [Op.ne]: excludeGalleryId } } : {}), [Op.or]: [{ imageUrl: url }, { videoUrl: url }] },
      attributes: ['id', 'userId', 'type', 'videoUrl'],
    }),
  ]);
  const { requiresAuthenticatedDelivery } = require('../utils/restrictedMedia');
  const allowedPublicly = async (ownerId, visibility = 'public', options = {}) => {
    if (!ownerId) return false;
    return !(await requiresAuthenticatedDelivery(ownerId, visibility, options));
  };
  for (const ref of profiles) if (await allowedPublicly(ref.userId)) return true;
  for (const ref of posts) if (await allowedPublicly(ref.userId)) return true;
  for (const ref of videos) {
    if (ignoreVideos && Number(ref.userId) === Number(userId)) continue;
    if (await allowedPublicly(ref.userId, 'public', { kind: 'video' })) return true;
  }
  for (const ref of streams) if (await allowedPublicly(ref.streamerId)) return true;
  for (const ref of galleries) {
    if (Number(ref.userId) === Number(userId) && (ignoreGallery || Number(ref.id) === Number(excludeGalleryId))) continue;
    const kind = ['video', 'highlight'].includes(String(ref.type || '').toLowerCase()) || Boolean(ref.videoUrl) ? 'video' : 'gallery';
    if (await allowedPublicly(ref.userId, 'public', { kind })) return true;
  }
  return false;
}

async function restrictCloudinaryAsset(url, { reason, jobOnFailure = true, userId, preserveExplicitPublicReferences = false, excludeGalleryId, ignoreGallery = false, ignoreVideos = false } = {}) {
  const asset = publicCloudinaryAsset(url);
  if (!asset) return { restrictedUrl: url, changed: false };
  if (preserveExplicitPublicReferences && await hasExplicitPublicReference(userId, url, { excludeGalleryId, ignoreGallery, ignoreVideos })) {
    return { restrictedUrl: url, changed: false, preservedPublicReference: true };
  }
  const restrictedUrl = String(url).replace(`/${asset.resourceType}/upload/`, `/${asset.resourceType}/authenticated/`);
  try {
    await cloudinary.uploader.rename(asset.publicId, asset.publicId, {
      resource_type: asset.resourceType,
      type: 'upload',
      to_type: 'authenticated',
      invalidate: true,
    });
    return { restrictedUrl, changed: true };
  } catch (error) {
    if (jobOnFailure) await enqueueCloudinaryMediaJob({ asset, reason: reason || 'privacy_restriction' });
    return { restrictedUrl, changed: true, queued: jobOnFailure, error: safeError(error) };
  }
}

async function processCloudinaryMediaJobs({ limit = 25, now = new Date() } = {}) {
  const { Op } = require('sequelize');
  const staleBefore = new Date(now.getTime() - 15 * 60 * 1000);
  // Recover jobs claimed by a process that exited before saving completion.
  await CloudinaryMediaJob.update(
    { status: 'pending' },
    { where: { status: 'processing', updatedAt: { [Op.lte]: staleBefore } } },
  );
  const jobs = await CloudinaryMediaJob.findAll({
    where: { status: 'pending', nextAttemptAt: { [Op.lte]: now } },
    order: [['nextAttemptAt', 'ASC'], ['id', 'ASC']],
    limit: Math.max(1, Math.min(Number(limit) || 25, 100)),
  });
  let completed = 0;
  let failed = 0;
  for (const job of jobs) {
    const claimed = await CloudinaryMediaJob.update(
      { status: 'processing', attempts: Number(job.attempts || 0) + 1 },
      { where: { id: job.id, status: 'pending' } },
    );
    if (!claimed[0]) continue;
    try {
      if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        throw new Error('Cloudinary credentials are not configured');
      }
      try {
        await cloudinary.api.resource(job.publicId, { resource_type: job.resourceType, type: job.toType });
        await job.update({ status: 'completed', completedAt: new Date(), lastError: null });
        completed += 1;
        continue;
      } catch (lookupError) {
        if (Number(lookupError?.http_code) !== 404 && !/not found/i.test(String(lookupError?.message || ''))) throw lookupError;
      }
      await cloudinary.uploader.rename(job.publicId, job.publicId, {
        resource_type: job.resourceType,
        type: job.fromType,
        to_type: job.toType,
        invalidate: true,
      });
      await job.update({ status: 'completed', completedAt: new Date(), lastError: null });
      completed += 1;
    } catch (error) {
      const attempts = Number(job.attempts || 0) + 1;
      const delay = Math.min(24 * 60 * 60 * 1000, 60 * 1000 * (2 ** Math.min(attempts - 1, 10)));
      await job.update({
        status: 'pending',
        nextAttemptAt: new Date(Date.now() + delay),
        lastError: safeError(error),
      });
      failed += 1;
    }
  }
  return { attempted: completed + failed, completed, failed };
}

module.exports = { enqueueCloudinaryMediaJob, restrictCloudinaryAsset, hasExplicitPublicReference, processCloudinaryMediaJobs };
