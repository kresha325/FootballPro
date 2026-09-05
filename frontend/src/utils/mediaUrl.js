/**
 * Shared media URL helpers for profile / gallery surfaces.
 */
const apiRoot = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

export const getFullUrl = (url) => {
  if (!url) return '';
  const normalized = url.startsWith('https//')
    ? url.replace('https//', 'https://')
    : url.startsWith('http//')
      ? url.replace('http//', 'http://')
      : url;
  if (/^https?:\/\//.test(normalized)) return normalized;
  if (/(^|\/)default-avatar\.png$/i.test(normalized)) return '/default-avatar.svg';
  return apiRoot + (normalized.startsWith('/') ? normalized : `/${normalized}`);
};

export const getApiUrl = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (apiRoot) return `${apiRoot}${normalizedPath}`;
  return normalizedPath;
};

export const fetchJsonSafe = async (path, options = {}) => {
  const response = await fetch(getApiUrl(path), options);
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  if (!contentType.includes('application/json')) {
    const bodyPreview = (await response.text()).slice(0, 80);
    throw new Error(`Expected JSON but received: ${bodyPreview}`);
  }
  return response.json();
};
