# Payments audit — Phase 8

**Date:** 2026-09-06

## Classification of existing flows

| Flow | Path | Classification | Mobile today | Store risk |
|------|------|----------------|--------------|------------|
| Premium monthly/yearly | `/api/premium/checkout` → Stripe Checkout **or demo** | **Digital subscription / unlock** | Opens browser / demo flag | **HIGH** — Apple/Google typically require IAP |
| JonCoin wallet top-up / transfer | `/api/joncoin` | **Digital currency** | In-app API | **HIGH** if sold for real money inside app |
| Marketplace products | Orders + Stripe (often disabled) | Mixed; physical goods OK off-IAP | Browse/cart in app | MEDIUM — depends if digital vs physical |
| Ads | Seller pays for placement | Advertising | Limited | MEDIUM |
| Live donations | JonCoin | Virtual tips | API | HIGH if cash ↔ coin without IAP |

## Current architecture decision (safe, no blind rewrite)

1. **Document** that Premium Stripe Checkout in mobile is **web-assisted**, not StoreKit/Play Billing.
2. Keep **demo mode** when `paymentsEnabled` is false.
3. **Blocker for store submission** until either:
   - Premium/JonCoin digital purchases move to **IAP**, or
   - Premium is removed/hidden from mobile binary and sold only on web (with careful App Review messaging), or
   - Digital goods are free/demo-only in the mobile build.

## Recommended next implementation (not done in this pass)

- Add `react-native-iap` / Expo IAP module
- Server receipt validation endpoints
- Feature-flag: `MOBILE_DIGITAL_IAP_ONLY=true` for production mobile builds

## Never store

Card numbers, Stripe secret keys, or raw payment credentials in the mobile bundle.
