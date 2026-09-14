export const APP_BRAND_NAME =
  (import.meta.env?.VITE_APP_NAME && String(import.meta.env.VITE_APP_NAME).trim()) ||
  'X TALENTI';

/** Virtual currency label shown in UI (API keys remain joncoin). */
export const APP_COIN_NAME = 'XCoin';

/** Stylized X mark (player + ball) used next to the wordmark. */
export const APP_LOGO_SRC = '/footballpro-icon.png';

/** Brand word without the leading X (shown next to the logo). */
export const APP_BRAND_WORDMARK = APP_BRAND_NAME.replace(/^x\s*/i, '').trim() || 'TALENTI';
