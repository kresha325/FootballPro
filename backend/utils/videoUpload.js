const fs = require('fs');

const ALLOWED_MIME = new Set([
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
]);

const ALLOWED_EXT = new Set(['.mp4', '.webm', '.ogg', '.mov']);
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

function extensionOf(name) {
  const raw = String(name || '').toLowerCase();
  const dot = raw.lastIndexOf('.');
  return dot >= 0 ? raw.slice(dot) : '';
}

function assertVideoFile(file) {
  if (!file) {
    const err = new Error('No video file provided');
    err.statusCode = 400;
    throw err;
  }
  const mime = String(file.mimetype || '').toLowerCase();
  const ext = extensionOf(file.originalname);
  if (!ALLOWED_MIME.has(mime) || !ALLOWED_EXT.has(ext)) {
    const err = new Error('Invalid video. Use MP4, WebM, OGG, or MOV.');
    err.statusCode = 400;
    throw err;
  }
  const size = Number(file.size);
  if (Number.isFinite(size) && size > MAX_VIDEO_BYTES) {
    const err = new Error('Video exceeds the 100MB limit.');
    err.statusCode = 413;
    throw err;
  }
  return true;
}

function assertDuration(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 60 * 60 * 6) {
    const err = new Error('Duration must be between 0 and 6 hours.');
    err.statusCode = 400;
    throw err;
  }
  return Math.round(n);
}

async function rollbackUpload({ localPath, publicId, cloudinary }) {
  if (publicId && cloudinary?.uploader?.destroy) {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
    } catch (_err) {
      /* best-effort remote cleanup */
    }
  }
  if (localPath) {
    try {
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    } catch (_err) {
      /* best-effort local cleanup */
    }
  }
}

module.exports = {
  ALLOWED_MIME,
  ALLOWED_EXT,
  MAX_VIDEO_BYTES,
  assertVideoFile,
  assertDuration,
  rollbackUpload,
};
