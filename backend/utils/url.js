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

module.exports = {
  getBaseUrl,
  toAbsoluteUploadsUrl,
};
