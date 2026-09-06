# Payments audit — Phase 8 + IAP

**Date:** 2026-09-06 (updated)

## Classification

| Flow | Path | Classification | Mobile | Store risk |
|------|------|----------------|--------|------------|
| Premium | IAP SKUs → `POST /api/iap/verify` | Digital subscription | StoreKit / Play Billing | Mitigated when IAP live |
| JonCoin packs | IAP consumables → verify | Virtual currency | StoreKit / Play Billing | Mitigated when IAP live |
| Marketplace | Orders | Physical/mixed | OK off-IAP if physical | MEDIUM |
| Stripe Premium (web) | `/api/premium/checkout` | Web-only | Not used when `ALLOW_MOBILE_DIGITAL_PURCHASES` | Keep for web |

## Product IDs (must match stores)

| SKU | Type | Fulfillment |
|-----|------|-------------|
| `com.kresha325.xtalenti.premium.monthly` | Subscription | Premium ~30 days |
| `com.kresha325.xtalenti.premium.yearly` | Subscription | Premium ~365 days |
| `com.kresha325.xtalenti.joncoin.100` | Consumable | +100 JC |
| `com.kresha325.xtalenti.joncoin.500` | Consumable | +500 JC |
| `com.kresha325.xtalenti.joncoin.1000` | Consumable | +1000 JC |

## Mobile flag

`app.json` → `extra.ALLOW_MOBILE_DIGITAL_PURCHASES: true` routes Premium/Wallet to **expo-iap**.

Requires a **dev client / EAS build** (not Expo Go). Rebuild after adding the `expo-iap` plugin.

## Backend

- `GET /api/iap/catalog` — product metadata
- `POST /api/iap/verify` — auth required; verifies receipt/token, fulfills Premium/JonCoin, idempotent on `transactionId`
- Migration: `IapPurchases` table

### Env

| Variable | Purpose |
|----------|---------|
| `APPLE_IAP_SHARED_SECRET` | Apple `verifyReceipt` (legacy) / staging gate |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Play Developer API (full verify still TODO) |
| `IAP_ALLOW_UNVERIFIED=true` | Dev/staging only — never production without real verify |

## Store setup checklist

1. Create the five products in App Store Connect + Google Play Console (same IDs).
2. Shared secret → Render `APPLE_IAP_SHARED_SECRET`.
3. Run migration `20260906193000-create-iap-purchases.js` on production DB.
4. EAS production rebuild with `expo-iap`.
5. Sandbox / license tester purchase → confirm Premium + JonCoin credit.

## Never store

Card numbers, Stripe secret keys, or raw payment credentials in the mobile bundle.
