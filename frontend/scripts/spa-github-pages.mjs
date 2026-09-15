/**
 * GitHub Pages nuk mbështet rewrite SPA → 200.
 *
 * 1) Kopjon index.html → 404.html që rrugët dinamike (/profile/7)
 *    të shërbejnë SPA (statusi mbetet 404 — kufizim i GitHub Pages).
 * 2) Krijon <route>.html për rrugët statike (/feed → feed.html)
 *    që hard-refresh të kthejë HTTP 200 pa trailing-slash (feed/).
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const indexHtml = resolve(dist, 'index.html');
const notFoundHtml = resolve(dist, '404.html');

/** Top-level static routes from App.jsx (no :params). */
const STATIC_ROUTES = [
  'feed',
  'login',
  'register',
  'forgot-password',
  'auth/callback',
  'onboarding',
  'parent-verification',
  'parent-verified',
  'profile',
  'profiles',
  'gallery',
  'search',
  'messaging',
  'embed-call',
  'embed-incoming-call',
  'embed-go-live',
  'marketplace',
  'notifications',
  'settings',
  'scouting',
  'streams',
  'tournaments',
  'analytics',
  'gamification',
  'premium',
  'matches',
  'admin',
  'club-roster',
  'videos',
  'wallet',
  'community-guidelines',
  'privacy',
  'terms',
  'cv',
  'share',
];

if (!existsSync(indexHtml)) {
  console.error('spa-github-pages: mungon dist/index.html — build dështoi?');
  process.exit(1);
}

copyFileSync(indexHtml, notFoundHtml);
console.log('spa-github-pages: dist/404.html = dist/index.html');

for (const route of STATIC_ROUTES) {
  // GitHub Pages: /feed → feed.html (200, pa redirect te /feed/)
  const out = join(dist, `${route}.html`);
  mkdirSync(dirname(out), { recursive: true });
  copyFileSync(indexHtml, out);
}

console.log(`spa-github-pages: ${STATIC_ROUTES.length} static *.html route files`);
