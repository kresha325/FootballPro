/**
 * GitHub Pages nuk mbështet rewrite SPA → 200.
 * Pas build, kopjojmë index.html si 404.html që hapja direkte
 * e /feed, /profile/:id etj. të shërbejë aplikacionin (jo faqe bosh).
 * URL-ja mbetet e njëjtë; React Router e lexon path-in normal.
 */
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const indexHtml = resolve(dist, 'index.html');
const notFoundHtml = resolve(dist, '404.html');

if (!existsSync(indexHtml)) {
  console.error('spa-github-pages: mungon dist/index.html — build dështoi?');
  process.exit(1);
}

copyFileSync(indexHtml, notFoundHtml);
console.log('spa-github-pages: dist/404.html = dist/index.html');
