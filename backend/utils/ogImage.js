const fs = require('fs');
const path = require('path');

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'da3t9gvne';
const PUBLIC_ID = 'branding/xtalenti-share-card';

const SITE_OG_FALLBACK = 'https://xtalenti.com/share-card.jpg';
const RENDER_OG_FALLBACK = 'https://footballpro.onrender.com/share-card.jpg';

let runtimeCloudinaryUrl = null;

function cloudinaryOgDeliveryUrl() {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/c_fill,f_jpg,h_630,q_auto,w_1200/${PUBLIC_ID}.jpg`;
}

function brandOgImageUrl() {
  if (process.env.OG_IMAGE_URL) return String(process.env.OG_IMAGE_URL).trim();
  if (runtimeCloudinaryUrl) return runtimeCloudinaryUrl;
  // Same-origin card first (no Render cold-start). Cloudinary replaces this after boot upload.
  return SITE_OG_FALLBACK;
}

function resolveLocalOgFiles() {
  const backendPublic = path.join(__dirname, '..', 'public');
  const frontendPublic = path.join(__dirname, '..', '..', 'frontend', 'public');
  const names = ['share-card.jpg', 'xtalenti-og.jpg', 'og-share.jpg'];
  const files = [];
  for (const name of names) {
    for (const dir of [backendPublic, frontendPublic]) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) files.push(p);
    }
  }
  return files;
}

function sendCleanJpeg(res, filePath) {
  const buf = fs.readFileSync(filePath);
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('Content-Security-Policy-Report-Only');
  res.removeHeader('Cross-Origin-Opener-Policy');
  res.removeHeader('Cross-Origin-Embedder-Policy');
  res.removeHeader('Origin-Agent-Cluster');
  res.removeHeader('X-Frame-Options');
  res.removeHeader('X-DNS-Prefetch-Control');
  res.removeHeader('X-Download-Options');
  res.removeHeader('X-Permitted-Cross-Domain-Policies');
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Content-Length', buf.length);
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.status(200).end(buf);
}

/** Mount BEFORE helmet/rate-limit so Facebook gets a plain JPEG response. */
function mountOgImageRoutes(app) {
  const handler = (req, res) => {
    const files = resolveLocalOgFiles();
    if (!files.length) return res.sendStatus(404);
    return sendCleanJpeg(res, files[0]);
  };
  app.get('/share-card.jpg', handler);
  app.get('/xtalenti-og.jpg', handler);
  app.get('/og-share.jpg', handler);
}

/**
 * Upload brand OG card to Cloudinary on boot so facebookexternalhit uses the
 * same CDN that already works for profile/cover photos.
 */
async function ensureOgImageOnCloudinary() {
  const hasCreds =
    (process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET) ||
    process.env.CLOUDINARY_URL;
  if (!hasCreds) {
    console.warn('[og-image] Cloudinary credentials missing — using', SITE_OG_FALLBACK);
    return null;
  }
  const files = resolveLocalOgFiles();
  if (!files.length) {
    console.warn('[og-image] No local share-card.jpg found to upload');
    return null;
  }
  try {
    const cloudinary = require('./cloudinary');
    const result = await cloudinary.uploader.upload(files[0], {
      public_id: PUBLIC_ID,
      overwrite: true,
      invalidate: true,
      resource_type: 'image',
    });
    runtimeCloudinaryUrl = cloudinaryOgDeliveryUrl();
    console.log('[og-image] Uploaded to Cloudinary:', result.secure_url || runtimeCloudinaryUrl);
    return runtimeCloudinaryUrl;
  } catch (err) {
    console.warn('[og-image] Cloudinary upload failed:', err?.message || err);
    return null;
  }
}

module.exports = {
  brandOgImageUrl,
  cloudinaryOgDeliveryUrl,
  mountOgImageRoutes,
  ensureOgImageOnCloudinary,
  resolveLocalOgFiles,
  SITE_OG_FALLBACK,
  RENDER_OG_FALLBACK,
};
