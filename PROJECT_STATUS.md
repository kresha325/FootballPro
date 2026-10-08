# FootballPro — Project Status (v1.0 completion)

Last updated: November 2026 (post full-platform audit). Goal: **feature-complete platform** with **card payments disabled** until launch; mobile in-app purchases (IAP) are live and cryptographically verified on iOS.

## Score: 9.5/10 (production-ready core; a few documented gaps below)

| Area | Web | Mobile | Backend | Notes |
|------|-----|--------|---------|-------|
| Auth & profiles | ✅ | ✅ | ✅ | Role-based edit, public profile, follow, account deletion |
| Feed & posts | ✅ | ✅ | ✅ | Likes, comments, share, gallery (mobile now uses `OptimizedImage` caching) |
| Messaging | ✅ | ✅ | ✅ | Reply, forward, read receipts, socket |
| Video calls | ✅ | ✅* | ✅ | *Mobile via WebView embed |
| Tournaments / Matches | ✅ | ✅ | ✅ | Bracket, scores, start, accept/reject, calendar, scorers |
| Marketplace | ✅ | ✅ | ✅ | **JonCoin only** (Stripe shop disabled); cart + orders |
| Wallet / JonCoin | ✅ | ✅ | ✅ | Balance, orders, withdrawals, IAP top-ups |
| Premium | ✅ | ✅ | ✅ | Demo-mode web checkout; **mobile IAP (Apple) is live and verified** |
| In-app purchases (IAP) | — | ✅ (iOS) / ❌ (Android) | ✅ | Apple StoreKit 2 JWS fully verified (chain + signature) against Apple's root CA; Google Play verification is **not implemented** — Android purchases are rejected server-side until a Play Developer API service account is wired up |
| Streams / Go Live | ✅ | ✅ | ✅ | LiveKit, YouTube parallel stream, scheduled streams, replay, guest co-host, live chat + moderation, donations, reactions |
| Scouting | ✅ | ✅ | ✅ | Dedicated scout role workflows, gated by `SCOUTING` admin feature flag |
| Analytics | ✅ | — | ✅ | Player/club analytics hub, gated by `ANALYTICS` admin feature flag |
| Clubs / Federations / Leagues | ✅ | ✅ | ✅ | Club roster + staff, federations, leagues (ligas), stadiums, national teams, sponsors |
| Gamification | ✅ | ✅ | ✅ | XP, badges, leaderboard |
| Moderation & support | ✅ | — | ✅ | User/content reports, live-chat moderation, support tickets |
| AI features | ✅ | partial | ✅ | `/api/ai` endpoints wired |
| Notifications | ✅ | partial | ✅ | Push API wired; mobile needs `expo-notifications` in an EAS build |
| Admin | ✅ | — | ✅ | Web admin panel; runtime feature flags (`LIVE_STREAMING`, `MARKETPLACE`, `JONCOIN`, `PREMIUM`, `SCOUTING`, `ANALYTICS`), maintenance mode, exports |

## Payments policy

- **Card payments (Stripe)**: `PAYMENTS_ENABLED` defaults to **false** — Stripe never used even if keys exist. Premium activates in **demo mode** via `POST /api/premium/checkout` on web. To go live: set `PAYMENTS_ENABLED=true` + valid `STRIPE_SECRET_KEY` on Render.
- **Mobile IAP (real money)**: live for iOS. `POST /api/iap/verify` requires full Apple StoreKit 2 JWS verification (`backend/utils/appleJws.js`) — the x5c certificate chain is validated up to Apple's embedded Root CA G3 and the ES256 signature is checked before any purchase is fulfilled; unverified/legacy receipts are rejected in production (`backend/utils/iapPolicy.js`). **Android IAP is not yet wired** — `verifyGooglePurchase` always returns unverified and purchases are rejected server-side in production.
- **Marketplace**: **JonCoin** only via `POST /api/orders`, no card processing involved.

Public config: `GET /api/config/public`

## How to test

### Frontend dev (API prod, no local DB)
```bash
cd frontend && cp .env.remote.example .env   # or: npm run dev:remote
npm run dev
```

### Backend smoke (no auth)
```bash
cd backend && npm run smoke:api:prod
```

### Backend smoke (with auth)
```bash
API_URL=https://footballpro.onrender.com TEST_EMAIL=you@email.com TEST_PASSWORD='...' npm run smoke:api
```

### Mobile static parity
```bash
cd mobile && node scripts/verify-parity-modules.js && npm run release:preflight
```

### Manual QA
See `mobile/RELEASE_QA.md` and `mobile/scripts/smoke-checklist.js`.

## Deploy checklist (Render)

1. Push `main` → auto deploy backend
2. **Migrations now run automatically on boot** — `npm start` runs `migrate:deploy` (`sequelize-cli db:migrate --env production`) before `node server.js`, using the same `DATABASE_URL` the app already connects with. The legacy GitHub Actions workflow (`run-migrations-prod.yml`) is optional/secondary now; see `docs/GITHUB_ACTIONS_MIGRATE.md`.
3. Env vars: `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `WEB_APP_URL` (mobile calls)
4. **Do not set** `PAYMENTS_ENABLED=true` until Stripe card payments are ready to go live
5. Verify: `curl https://footballpro.onrender.com/api/config/public`
6. Verify: `curl https://footballpro.onrender.com/api/streams`

## Known limitations (honest)

1. **RTMP ingest server** — OBS stream key shown; nginx-rtmp not on Render (optional). In-app broadcast uses **LiveKit** (web embed) or **YouTube** parallel stream.
2. **Push notifications on mobile** — API ready (`POST /api/profiles/me/push-token`); requires `expo-notifications` in EAS build.
3. **Dual live APIs** — `/api/streams` (primary) + legacy `/api/live-stream` (web profile); unified long-term.
4. **i18n** — Web has locales; mobile English/Albanian mix in UI strings.
5. **Android IAP not implemented** — `backend/controllers/iap.js`'s `verifyGooglePurchase` has no Google Play Developer API wiring yet; Android in-app purchases fail verification and are rejected in production. Needs a Play service account + `googleapis`/Play Developer API integration mirroring the Apple JWS work.
6. **One remaining moderate `npm audit` finding (backend)** — `file-type`'s DoS CVE and the `nodemailer`/`cloudinary` HIGH CVEs are fixed; the only item left is `uuid`'s buffer-bounds advisory, pulled in transitively by `sequelize@6` (reported against both `sequelize` and `uuid` in the audit output, same root cause). Not exploitable here (we never call `uuid.v3/v5/v6` with a custom buffer — sequelize only uses `v4()` internally) and the only upstream fix requires a `sequelize` v6→v7+ major upgrade across the whole ORM layer. Accepted risk, tracked here instead of forced.

## Recent hardening (November 2026 audit pass)

- **Production DB migrations now auto-apply on every deploy/restart** — previously the GitHub Actions migration workflow had been silently failing for a long time (missing secrets), so 38+ migrations (including a critical `hot-query-indexes` migration) had never been applied in production.
- **Apple StoreKit 2 purchases are now cryptographically verified** (`backend/utils/appleJws.js`) — previously the JWS payload was only decoded, never signature-checked, and was rejected outright in production, meaning real iOS purchases were never fulfilled. Now the full x5c chain + ES256 signature is verified against Apple's Root CA before crediting JonCoin/Premium.
- **nodemailer 7→10 and cloudinary 1→2** upgraded, resolving HIGH severity CVEs (SMTP/CRLF injection family, jsonTransport bypass; arbitrary argument injection). No breaking API changes for this codebase's usage.
- **file-type 16→21** upgraded, resolving a moderate ASF-parser DoS; migrated to the library's new ESM-only API via dynamic `import()`.
- **Mobile performance** — resized 3 oversized (386-513KB) Home-screen icons down ~94%, and switched `GalleryScreen` to the app's `OptimizedImage` component instead of a raw unoptimized `Image`.

## What was completed in an earlier push (May 2026)

- Payments guard (`backend/config/payments.js`)
- Public config endpoint
- Push token route
- Tournament participant accept/reject (mobile)
- Knockout bracket + round advance
- Stream–User association fix
- ClubStaff enum migrations
- Mobile standings fix, SafeArea white screen fix
- API smoke script + npm scripts

## Registration & onboarding (May 2026)

- **Backend:** validim email/roli/DOB; profil krijohet me `city`/`country`; nën 18 → `requiresParentVerification`
- **Mobile:** regjistrim me datëlindje, konfirmim fjalëkalimi, kushte; **onboarding 2 hapa** pas regjistrimit
- **Web:** `/onboarding` pas `/register`; datëlindja e detyrueshme

## Next polish (optional, post-launch)

- EAS production build with push notifications
- Google Play IAP verification (Android currently rejected server-side)
- Consolidate live-stream APIs
- Dark mode persistence (mobile)
- E2E tests (Detox / Playwright)
- Enable Stripe when legally/commercially ready

---

*2+ years of work — this document marks the **1.0 feature-complete** line. Card payments (Stripe) stay off by design until you flip the switch; mobile IAP (iOS) is already live with full cryptographic verification.*
