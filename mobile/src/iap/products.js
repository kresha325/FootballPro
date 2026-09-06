/** IAP product IDs — must match App Store Connect + Google Play Console. */
export const IAP_PRODUCTS = {
  premiumMonthly: 'com.kresha325.xtalenti.premium.monthly',
  premiumYearly: 'com.kresha325.xtalenti.premium.yearly',
  joncoin100: 'com.kresha325.xtalenti.joncoin.100',
  joncoin500: 'com.kresha325.xtalenti.joncoin.500',
  joncoin1000: 'com.kresha325.xtalenti.joncoin.1000',
};

export const PREMIUM_SKUS = [IAP_PRODUCTS.premiumMonthly, IAP_PRODUCTS.premiumYearly];
export const JONCOIN_SKUS = [IAP_PRODUCTS.joncoin100, IAP_PRODUCTS.joncoin500, IAP_PRODUCTS.joncoin1000];

export const JONCOIN_PACKS = [
  { sku: IAP_PRODUCTS.joncoin100, amount: 100, label: '100 JonCoin' },
  { sku: IAP_PRODUCTS.joncoin500, amount: 500, label: '500 JonCoin' },
  { sku: IAP_PRODUCTS.joncoin1000, amount: 1000, label: '1000 JonCoin' },
];

export function premiumSkuForPlan(plan) {
  return plan === 'yearly' ? IAP_PRODUCTS.premiumYearly : IAP_PRODUCTS.premiumMonthly;
}
