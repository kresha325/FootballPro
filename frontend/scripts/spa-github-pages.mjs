/**
 * GitHub Pages nuk mbështet rewrite SPA → 200.
 *
 * 1) Kopjon index.html → 404.html që rrugët dinamike (/profile/7)
 *    të shërbejnë SPA (statusi mbetet 404 — kufizim i GitHub Pages).
 * 2) Krijon <route>.html për rrugët statike (/feed → feed.html)
 *    që hard-refresh të kthejë HTTP 200 pa trailing-slash (feed/).
 * 3) Legal pages (privacy/terms/guidelines) shkruhen si HTML statik
 *    që Apple/TestFlight / crawlers të lexojnë politikën pa JavaScript.
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { renderLegalStaticHtml } from '../src/content/legalPages.js';

const dist = resolve(process.cwd(), 'dist');
const indexHtml = resolve(dist, 'index.html');
const notFoundHtml = resolve(dist, '404.html');

/** Top-level static routes from App.jsx (no :params). Legal routes overwritten below. */
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

const LEGAL_KINDS = ['privacy', 'terms', 'community-guidelines'];

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

for (const kind of LEGAL_KINDS) {
  const html = renderLegalStaticHtml(kind);
  if (!html) continue;
  const fileOut = join(dist, `${kind}.html`);
  writeFileSync(fileOut, html, 'utf8');
  // Also /privacy/index.html for trailing-slash URLs
  const dirOut = join(dist, kind, 'index.html');
  mkdirSync(dirname(dirOut), { recursive: true });
  writeFileSync(dirOut, html, 'utf8');
  console.log(`spa-github-pages: static legal → ${kind}.html + ${kind}/index.html`);
}

console.log(`spa-github-pages: ${STATIC_ROUTES.length} static *.html route files`);
