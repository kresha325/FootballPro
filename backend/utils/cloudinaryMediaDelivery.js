'use strict';

const cloudinary = require('./cloudinary');

const SIGNED_URL_TTL_SECONDS = 15 * 60;

function isAuthenticatedCloudinaryUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return /(^|\.)res\.cloudinary\.com$/i.test(url.hostname) &&
      /\/(image|video|raw)\/authenticated\//.test(url.pathname);
  } catch {
    return false;
  }
}

function cloudinaryAssetParts(value) {
  const url = new URL(value);
  const parts = url.pathname.split('/').filter(Boolean);
  const typeIndex = parts.findIndex((part, index) => ['image', 'video', 'raw'].includes(part) && parts[index + 1] === 'authenticated');
  if (typeIndex < 0) return null;
  const resourceType = parts[typeIndex];
  let assetParts = parts.slice(typeIndex + 2).filter((part) => !/^s--[^/]+--$/.test(part));
  if (/^v\d+$/.test(assetParts[0] || '')) assetParts = assetParts.slice(1);
  // Strip only transformation segments before the public-id path.
  while (assetParts.length > 1 && /^(?:t_[^/]+|(?:a|c|w|h|q|f|g|r|x|y|e|d|b|l|o|fl)_[^/]+)(?:,|$)/.test(assetParts[0])) assetParts.shift();
  const assetPath = assetParts.join('/');
  const lastSlash = assetPath.lastIndexOf('/');
  const filename = assetPath.slice(lastSlash + 1);
  const dot = filename.lastIndexOf('.');
  return {
    resourceType,
    publicId: dot > 0 ? `${assetPath.slice(0, assetPath.length - filename.length)}${filename.slice(0, dot)}` : assetPath,
    format: dot > 0 ? filename.slice(dot + 1) : undefined,
  };
}

function publicCloudinaryAsset(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (!/(^|\.)res\.cloudinary\.com$/i.test(url.hostname)) return null;
    const match = url.pathname.match(/\/(image|video|raw)\/upload\/(.+)$/);
    if (!match) return null;
    const resourceType = match[1];
    let segments = match[2].split('/');
    const versionIndex = segments.findIndex((segment) => /^v\d+$/.test(segment));
    if (versionIndex >= 0) segments = segments.slice(versionIndex + 1);
    else segments = segments.filter((segment) => !/^(?:t_[^/]+|(?:a|c|w|h|q|f|g|r|x|y|e|d|b|l|o|fl)_[^/]+)(?:,|$)/.test(segment));
    const assetPath = segments.join('/');
    const leaf = assetPath.slice(assetPath.lastIndexOf('/') + 1);
    const extensionAt = leaf.lastIndexOf('.');
    const publicId = extensionAt > 0
      ? `${assetPath.slice(0, assetPath.length - leaf.length)}${leaf.slice(0, extensionAt)}`
      : assetPath;
    if (!publicId) return null;
    return { resourceType, publicId, format: extensionAt > 0 ? leaf.slice(extensionAt + 1) : undefined };
  } catch { return null; }
}

function authenticatedDeliveryUrl(value) {
  const asset = publicCloudinaryAsset(value);
  if (!asset) return null;
  const url = new URL(value);
  url.pathname = url.pathname.replace(`/${asset.resourceType}/upload/`, `/${asset.resourceType}/authenticated/`);
  return url.toString();
}

function signAuthenticatedCloudinaryUrl(value, now = Date.now(), client = cloudinary) {
  if (!isAuthenticatedCloudinaryUrl(value)) return value;
  if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET || !process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error('Cloudinary signing is not configured');
  }
  const parts = cloudinaryAssetParts(value);
  if (!parts) throw new Error('Unsupported authenticated Cloudinary URL');
  return client.utils.private_download_url(parts.publicId, parts.format, {
    resource_type: parts.resourceType,
    type: 'authenticated',
    expires_at: Math.floor(now / 1000) + SIGNED_URL_TTL_SECONDS,
  });
}

async function signMediaInPayload(payload, options = {}) {
  const seen = new WeakMap();
  let signedCount = 0;
  async function visit(value) {
    if (typeof value === 'string' && isAuthenticatedCloudinaryUrl(value)) {
      signedCount += 1;
      return signAuthenticatedCloudinaryUrl(value, options.now, options.client || cloudinary);
    }
    if (!value || typeof value !== 'object') return value;
    if (seen.has(value)) return seen.get(value);
    const target = Array.isArray(value) ? [] : { ...value };
    seen.set(value, target);
    for (const key of Object.keys(target)) target[key] = await visit(target[key]);
    return target;
  }
  return { payload: await visit(payload), signedCount };
}

function cloudinaryMediaDelivery(req, res, next) {
  const sendJson = res.json.bind(res);
  res.json = function secureJson(body) {
    const serialized = body && typeof body.toJSON === 'function' ? body.toJSON() : body;
    // Keep the synchronous, zero-work path for existing public media and APIs.
    if (!JSON.stringify(serialized || null).includes('/authenticated/')) return sendJson(body);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    if (!req.user) {
      // Authenticated assets are never emitted as credentials to anonymous
      // callers. Explicit public media continues using ordinary upload URLs.
      const redact = (value) => {
        if (typeof value === 'string') return isAuthenticatedCloudinaryUrl(value) ? null : value;
        if (!value || typeof value !== 'object') return value;
        if (Array.isArray(value)) return value.map(redact);
        return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, redact(child)]));
      };
      return sendJson(redact(serialized));
    }
    signMediaInPayload(serialized).then(({ payload }) => sendJson(payload)).catch((error) => {
      console.error('Authenticated media signing failed:', error?.message || error);
      // Fail closed. A signed asset URL is a bearer credential; never send the
      // persistent Cloudinary delivery URL when signing fails.
      const redact = (value) => {
        if (typeof value === 'string') return isAuthenticatedCloudinaryUrl(value) ? null : value;
        if (!value || typeof value !== 'object') return value;
        if (Array.isArray(value)) return value.map(redact);
        return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, redact(child)]));
      };
      sendJson(redact(serialized));
    });
    return res;
  };
  next();
}

module.exports = {
  SIGNED_URL_TTL_SECONDS,
  isAuthenticatedCloudinaryUrl,
  cloudinaryAssetParts,
  publicCloudinaryAsset,
  authenticatedDeliveryUrl,
  signAuthenticatedCloudinaryUrl,
  signMediaInPayload,
  cloudinaryMediaDelivery,
};
