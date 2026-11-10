const MiB = 1024 * 1024;

// Keep client guidance aligned with backend/utils/uploadLimits.js.
export const UPLOAD_LIMITS = Object.freeze({
  image: 10 * MiB,
  video: 100 * MiB,
  messageAttachment: 25 * MiB,
  groupAvatar: 5 * MiB,
});

export function assetSize(asset) {
  const size = Number(asset?.fileSize ?? asset?.filesize ?? asset?.size ?? 0);
  return Number.isFinite(size) && size > 0 ? size : 0;
}

export function isAssetOverLimit(asset, limit) {
  const size = assetSize(asset);
  return size > 0 && size > limit;
}
