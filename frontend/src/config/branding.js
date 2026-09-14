export const APP_BRAND_NAME =
  (import.meta.env?.VITE_APP_NAME && String(import.meta.env.VITE_APP_NAME).trim()) ||
  'X TALENTI';

/** Virtual currency label shown in UI (API keys remain joncoin). */
export const APP_COIN_NAME = 'XCoin';

/** Stylized X mark (player + ball) used next to the wordmark. */
export const APP_LOGO_SRC = '/footballpro-icon.png';

/** Brand word without the leading X (shown next to the logo). */
export const APP_BRAND_WORDMARK = APP_BRAND_NAME.replace(/^x\s*/i, '').trim() || 'TALENTI';

/** Absolute OG image URL (CDN) — used for social crawlers; GH Pages images often fail on Facebook. */
export const APP_OG_IMAGE_ABS =
  'https://cdn.jsdelivr.net/gh/kresha325/FootballPro@main/frontend/public/xtalenti-og.jpg';

/** Default Open Graph / social share image path on this origin (1200x630). */
export const APP_OG_IMAGE = '/xtalenti-og.jpg';

/** Full brand banner for marketing surfaces. */
export const APP_BRAND_BANNER = '/xtalenti-brand-banner.png';
