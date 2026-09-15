/**
 * Cloudflare Worker — restore rich CV Open Graph on xtalenti.com.
 *
 * DNS: orange-cloud xtalenti.com (proxy) in front of GitHub Pages.
 * Route: xtalenti.com/*
 *
 * - Social bots on /cv/:id or /share/cv/:id → Render OG HTML
 * - Everyone else → GitHub Pages origin (pass-through)
 *
 * Deploy: wrangler deploy (account must already manage xtalenti.com).
 */
const OG_API = 'https://footballpro.onrender.com';
const BOT_UA =
  /bot|crawl|slurp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|Telegram|Discord|TikTok/i;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ua = request.headers.get('user-agent') || '';
    const isBot = BOT_UA.test(ua);

    const cvMatch = url.pathname.match(/^\/(?:share\/)?cv\/(\d+)\/?$/i);
    if (cvMatch && isBot) {
      const target = `${OG_API}/share/cv/${cvMatch[1]}${url.search}`;
      return fetch(target, {
        headers: { 'user-agent': ua, accept: 'text/html' },
        redirect: 'manual',
      });
    }

    if (url.pathname === '/share' || url.pathname.startsWith('/share/')) {
      const target = `${OG_API}${url.pathname}${url.search}`;
      return fetch(target, {
        headers: { 'user-agent': ua, accept: 'text/html' },
        redirect: 'manual',
      });
    }

    // Pass through to origin (GitHub Pages) — Worker must be configured with route only,
    // or set ORIGIN_HOST in env (e.g. kresha325.github.io).
    if (env?.ORIGIN_HOST) {
      const originUrl = new URL(request.url);
      originUrl.hostname = env.ORIGIN_HOST;
      return fetch(originUrl.toString(), request);
    }

    return fetch(request);
  },
};
