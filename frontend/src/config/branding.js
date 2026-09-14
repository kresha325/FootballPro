export const APP_BRAND_NAME =
  (import.meta.env?.VITE_APP_NAME && String(import.meta.env.VITE_APP_NAME).trim()) ||
  'XTalenti';

/** Stylized X mark (player + ball) used next to the wordmark. */
export const APP_LOGO_SRC = '/footballpro-icon.png';

/** Brand word without the leading X (shown next to the logo). */
export const APP_BRAND_WORDMARK = APP_BRAND_NAME.replace(/^x/i, '').trim() || 'Talenti';
