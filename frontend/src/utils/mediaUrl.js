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

/** True if URL or gallery item looks like a video. */
export const isVideoMedia = (itemOrUrl) => {
  if (!itemOrUrl) return false;
  if (typeof itemOrUrl === 'string') {
    return /\/video\/upload\/|\.(mp4|mov|webm|m4v|avi|mkv)(\?|$)/i.test(itemOrUrl);
  }
  if (itemOrUrl.type === 'video' || itemOrUrl.videoUrl) return true;
  const u = itemOrUrl.imageUrl || itemOrUrl.thumbnail || '';
  return isVideoMedia(u);
};

/**
 * Poster/thumbnail for a video URL. Cloudinary: first-frame JPG.
 * Other hosts: returns '' (caller should use <video> instead of <img>).
 */
export const getVideoPosterUrl = (videoUrl) => {
  const u = getFullUrl(videoUrl);
  if (!u) return '';
  if (/res\.cloudinary\.com\/[^/]+\/video\/upload\//i.test(u)) {
    return u
      .replace(/\/video\/upload\//i, '/video/upload/so_0,w_640,h_640,c_fill,f_jpg,q_auto/')
      .replace(/\.(mp4|mov|webm|m4v|avi|mkv)(\?.*)?$/i, '.jpg$2');
  }
  return '';
};

/** Best URL to play (video) or show (image). */
export const getGalleryMediaUrl = (item) => {
  if (!item) return '';
  if (item.videoUrl) return getFullUrl(item.videoUrl);
  if (item.imageUrl && isVideoMedia(item.imageUrl)) return getFullUrl(item.imageUrl);
  return getFullUrl(item.imageUrl || item.thumbnail || '');
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
