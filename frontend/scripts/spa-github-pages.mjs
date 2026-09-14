/**
 * GitHub Pages nuk mbështet rewrite SPA → 200.
 *
 * 1) Kopjon index.html → 404.html që rrugët dinamike (/profile/7)
 *    të shërbejnë SPA (statusi mbetet 404 — kufizim i GitHub Pages).
 * 2) Krijon <route>/index.html për rrugët statike (/feed, /login, …)
 *    që hard-refresh të kthejë HTTP 200, jo 404 në Network.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

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
];

if (!existsSync(indexHtml)) {
  console.error('spa-github-pages: mungon dist/index.html — build dështoi?');
  process.exit(1);
}

copyFileSync(indexHtml, notFoundHtml);
console.log('spa-github-pages: dist/404.html = dist/index.html');

for (const route of STATIC_ROUTES) {
  const dir = join(dist, ...route.split('/'));
  mkdirSync(dir, { recursive: true });
  copyFileSync(indexHtml, join(dir, 'index.html'));
}

console.log(`spa-github-pages: ${STATIC_ROUTES.length} static route folders with index.html`);
