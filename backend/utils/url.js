const getBaseUrl = (req) => {
  const envBase = process.env.PUBLIC_BASE_URL || process.env.BACKEND_URL;
  if (envBase) {
    return envBase.replace(/\/$/, '');
  }
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = forwardedProto ? forwardedProto.split(',')[0] : req.protocol;
  return `${protocol}://${req.get('host')}`;
};

const toAbsoluteUploadsUrl = (req, value) => {
  if (!value) return value;
  const normalized = value.startsWith('https//')
    ? value.replace('https//', 'https://')
    : value.startsWith('http//')
      ? value.replace('http//', 'http://')
      : value;
  if (/^https?:\/\//i.test(normalized)) return normalized;

  let normalizedPath = normalized;
  if (normalized.includes('/uploads/')) {
    const filename = normalized.split('/uploads/').pop();
    normalizedPath = `/uploads/${filename}`;
  } else if (normalized.startsWith('uploads/')) {
    normalizedPath = `/${normalized}`;
  }

  if (normalizedPath.startsWith('/uploads/')) {
    return `${getBaseUrl(req)}${normalizedPath}`;
  }

  return normalized;
};

/**
 * Facebook needs a large landscape JPEG (~1200×630). Profile/cover Cloudinary
 * URLs are often portrait/small with f_auto — rewrite to a fill crop JPG.
 */
const toFacebookOgImageUrl = (absoluteUrl, fallbackUrl) => {
  const fallback = fallbackUrl || 'https://xtalenti.com/og-share.jpg';
  if (!absoluteUrl) return fallback;
  const url = String(absoluteUrl).trim();
  if (!/^https?:\/\//i.test(url)) return fallback;

  const cloudinary = url.match(
    /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/i
  );
  if (cloudinary) {
    const rest = cloudinary[2];
    // Drop existing transforms; keep version + public_id (…/v123/folder/id or folder/id)
    const publicId = rest.replace(/^(?:[^/]+\/)+?(?=(?:v\d+\/)?[^/]+)/, (prefix) => {
      // Only strip segments that look like transforms (f_auto, w_100, …)
      const segs = prefix.split('/').filter(Boolean);
      const allTransforms = segs.every((s) => /[,_=]|^(f|q|w|h|c|g|e|b|a|dpr|fl)_/.test(s) || /,/.test(s));
      return allTransforms ? '' : prefix;
    });
    const cleaned = publicId.replace(/^\/+/, '') || rest.replace(/^[^/]+\//, '');
    return `${cloudinary[1]}w_1200,h_630,c_fill,g_auto,f_jpg,q_auto/${cleaned}`;
  }

  return url;
};

/**
 * Cloudinary video → first-frame JPG for thumbnails / OG.
 */
const toCloudinaryVideoPosterUrl = (absoluteUrl) => {
  const url = String(absoluteUrl || '').trim();
  if (!url || !/res\.cloudinary\.com\/[^/]+\/video\/upload\//i.test(url)) return null;
  return url
    .replace(/\/video\/upload\//i, '/video/upload/so_0,w_640,h_640,c_fill,f_jpg,q_auto/')
    .replace(/\.(mp4|mov|webm|m4v|avi|mkv)(\?.*)?$/i, '.jpg$2');
};

module.exports = {
  getBaseUrl,
  toAbsoluteUploadsUrl,
  toFacebookOgImageUrl,
  toCloudinaryVideoPosterUrl,
};
