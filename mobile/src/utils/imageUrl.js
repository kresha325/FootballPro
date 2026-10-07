/**
 * Downscale Cloudinary image delivery URLs.
 * Same insertion point the web feed uses (`/image/upload/`), plus width/height
 * when a thumbnail size is requested. Anything else is returned unchanged.
 */
export function getOptimizedImageUrl(url, options = {}) {
  if (!url || typeof url !== 'string') return url || '';
  try {
    const marker = '/image/upload/';
    if (!url.includes('res.cloudinary.com') || !url.includes(marker)) return url;
    const rest = url.slice(url.indexOf(marker) + marker.length);
    const firstSegment = rest.split('/')[0] || '';
    if (firstSegment.includes(',') || /^(f_|q_|w_|h_|c_|g_|so_|dpr_|fl_)/.test(firstSegment)) {
      return url;
    }
    const width = Number(options.width);
    const height = Number(options.height);
    const parts = [`f_${options.format || 'auto'}`, `q_${options.quality || 'auto'}`];
    if (Number.isFinite(width) && width > 0) parts.push(`w_${Math.round(width)}`);
    if (Number.isFinite(height) && height > 0) parts.push(`h_${Math.round(height)}`);
    if (parts.some((part) => part.startsWith('w_') || part.startsWith('h_'))) parts.push('c_limit');
    return url.replace(marker, `${marker}${parts.join(',')}/`);
  } catch (_err) {
    return url;
  }
}
