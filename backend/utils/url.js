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
  if (/^https?:\/\//i.test(value)) return value;

  let normalized = value;
  if (value.includes('/uploads/')) {
    const filename = value.split('/uploads/').pop();
    normalized = `/uploads/${filename}`;
  } else if (value.startsWith('uploads/')) {
    normalized = `/${value}`;
  }

  if (normalized.startsWith('/uploads/')) {
    return `${getBaseUrl(req)}${normalized}`;
  }

  return value;
};

module.exports = {
  getBaseUrl,
  toAbsoluteUploadsUrl,
};
