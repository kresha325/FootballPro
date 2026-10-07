# Branding note

Nothing was renamed. This is a map so one name can be chosen later.

The UI already has two switches:

- Web and mobile show `X TALENTI` unless `VITE_APP_NAME` or the Expo app name overrides it (`frontend/src/config/branding.js`, `mobile/src/config/branding.js`).
- The currency label in the UI is `XCoin`. API fields, routes, and the ledger stay `joncoin`.

Generated iOS Pods, `package-lock.json`, and local `.env` files also contain some of these strings. They are not listed below.

## X TALENTI / xtalenti

Public name and host.

- Site and links: `xtalenti.com`, deep link scheme `xtalenti`, package `com.kresha325.xtalenti`.
- App name: `mobile/app.json` (`name` is `X TALENTI`, `slug` is `footballpro-mobile`, schemes `xtalenti` and `footballpro`).
- Web shell: `frontend/index.html`, `frontend/public/manifest.webmanifest`, `frontend/public/robots.txt`, `frontend/src/index.css`, `frontend/tailwind.config.js`.
- Copy and screens: `frontend/src/components/` (Landing, Auth, Feed, Settings, Premium, legal pages) and the matching screens under `mobile/src/screens/`.
- Backend mail, OAuth, CORS, and share links: `backend/utils/corsPolicy.js`, `backend/utils/oauthExchange.js`, `backend/utils/ogImage.js`, `backend/services/emailService.js`, `backend/routes/auth.js`.

## FootballPro

Repository, API host, and older docs.

- Host: `footballpro.onrender.com` (`frontend/src/config/branding.js` OG image, smoke scripts).
- Repo and deploy notes: `README.md`, `PROJECT_STATUS.md`, `HTTPS_SETUP.md`, `frontend/RENDER_DEPLOY.md`, `mobile/README.md`.
- Admin copy: `backend/services/admin/policy.js`, `backend/services/admin/ops.js`, `backend/services/admin/settings.js`, `frontend/src/components/admin/platformState.jsx`.
- One product string: `frontend/src/components/LiveDiscovery.jsx`.
- Older guides under `docs/` (`QUICK_START.md`, `EMAIL_SETUP.md`, `MULTI_USER_TESTING.md`, livestream and video-call notes) and `deployment/mediasoup/`.

## JonSport

Backend package name, not the public brand.

- `backend/package.json` name `jonsport-backend`.
- `backend/.env.example` database name `jonsport_dev`.
- `README.md`.
- Web push fallback contact: `mailto:admin@jonsport.com` in `backend/services/notifications/service.js`.

## JonCoin

Stored name of the ledger. Routes stay `/api/joncoin`.

- Models and migrations: `backend/models/JonCoinWallet.js`, `backend/models/JonCoinTransaction.js`, `backend/migrations/20260124-create-joncoinwallet.js`, `backend/migrations/20260125-create-joncoin-transactions.js`, `backend/migrations/20260125-add-joncoin-balance-to-users.js`.
- API: `backend/controllers/joncoin.js`, `backend/routes/joncoin.js`, `backend/services/economy/`, `backend/docs/JonCoin_API.md`, `backend/docs/JonCoin_backend_design.md`.
- Web: `frontend/src/services/joncoin.js`, `frontend/src/components/JonCoinWallet.jsx`, wallet, cart, checkout, and admin screens.
- Mobile: `WalletScreen.js`, marketplace screens, `mobile/src/context/CartContext.js`, `mobile/src/iap/products.js`.

## XCoin

Label shown to people. The comment in both branding files says the API keys remain `joncoin`.

- `APP_COIN_NAME` in `frontend/src/config/branding.js` and `mobile/src/config/branding.js`.
- Legal copy: `frontend/src/content/legalPages.js`, `mobile/src/content/legalPages.js`.
- The same wallet, marketplace, premium, and checkout screens listed under JonCoin, plus `LandingPage.jsx`, `Premium.jsx`, and `GlobalSearch.jsx`.
