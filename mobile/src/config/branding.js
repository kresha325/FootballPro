import Constants from 'expo-constants';

const raw = Constants.expoConfig?.name || 'X TALENTI';
export const APP_BRAND_NAME = raw.replace(/\s+Mobile\s*$/i, '').trim() || 'X TALENTI';

/** Virtual currency label shown in UI (API keys remain joncoin). */
export const APP_COIN_NAME = 'XCoin';

export const APP_BRAND_WORDMARK = APP_BRAND_NAME.replace(/^x\s*/i, '').trim() || 'TALENTI';
