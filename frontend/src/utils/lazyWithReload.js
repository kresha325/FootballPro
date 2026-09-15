import { lazy } from 'react';

function isChunkLoadError(err) {
  const msg = String(err?.message || err || '');
  return (
    err?.name === 'ChunkLoadError' ||
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('Loading chunk') ||
    msg.includes('error loading dynamically imported module')
  );
}

/**
 * Like React.lazy, but after a deploy old hashed chunks 404.
 * Reloads once so the browser picks up the new index.html asset map.
 */
export function lazyWithReload(factory) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      if (isChunkLoadError(err) && typeof window !== 'undefined') {
        const key = 'fp_chunk_reload';
        const last = Number(sessionStorage.getItem(key) || 0);
        if (!last || Date.now() - last > 15_000) {
          sessionStorage.setItem(key, String(Date.now()));
          window.location.reload();
          return new Promise(() => {});
        }
      }
      throw err;
    }
  });
}

export { isChunkLoadError };
