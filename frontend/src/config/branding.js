export const APP_BRAND_NAME =
  (import.meta.env?.VITE_APP_NAME && String(import.meta.env.VITE_APP_NAME).trim()) ||
  'X TALENTI';

/** Virtual currency label shown in UI (API keys remain joncoin). */
export const APP_COIN_NAME = 'XCoin';

/** Stylized X mark (player + ball) used next to the wordmark. */
export const APP_LOGO_SRC = '/footballpro-icon.png';

/** Brand word without the leading X (shown next to the logo). */
export const APP_BRAND_WORDMARK = APP_BRAND_NAME.replace(/^x\s*/i, '').trim() || 'TALENTI';

/** Absolute OG image — Cloudinary (facebookexternalhit already reaches this CDN). */
export const APP_OG_IMAGE_ABS =
  'https://res.cloudinary.com/da3t9gvne/image/upload/c_fill,f_jpg,fl_progressive:none,h_630,q_auto,w_1200/branding/xtalenti-share-card.jpg';

/** Default Open Graph / social share image path on this origin (1200x630). */
export const APP_OG_IMAGE = '/share-card.jpg';

/** Full brand banner for marketing surfaces. */
export const APP_BRAND_BANNER = '/xtalenti-brand-banner.png';
