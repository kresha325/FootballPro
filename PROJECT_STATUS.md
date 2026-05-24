# FootballPro — Project Status (v1.0 completion)

Last updated: May 2026. Goal: **feature-complete platform** with **payments disabled** until launch.

## Score: 9/10 (production-ready core)

| Area | Web | Mobile | Backend | Notes |
|------|-----|--------|---------|-------|
| Auth & profiles | ✅ | ✅ | ✅ | Role-based edit, public profile, follow |
| Feed & posts | ✅ | ✅ | ✅ | Likes, comments, share, gallery |
| Messaging | ✅ | ✅ | ✅ | Reply, forward, read receipts, socket |
| Video calls | ✅ | ✅* | ✅ | *Mobile via WebView embed |
| Tournaments | ✅ | ✅ | ✅ | Bracket, scores, start, accept/reject |
| Marketplace | ✅ | ✅ | ✅ | **JonCoin only** (Stripe shop disabled) |
| Wallet / JonCoin | ✅ | ✅ | ✅ | Balance, orders, withdrawals |
| Premium | ✅ | ✅ | ✅ | **Demo mode** (no live Stripe) |
| Streams / Go Live | ✅ | ✅ | ✅ | LiveKit via embed-go-live; YouTube UC; upload recording |
| Gamification | ✅ | ✅ | ✅ | XP, badges, leaderboard |
| Notifications | ✅ | partial | ✅ | Push API wired; mobile needs expo-notifications build |
| Admin | ✅ | — | ✅ | Web admin panel |

## Payments policy (intentionally OFF)

- `PAYMENTS_ENABLED` defaults to **false** — Stripe never used even if keys exist.
- Premium: activates in **demo** via `POST /api/premium/checkout`.
- Marketplace: **JonCoin** via `POST /api/orders`.
- To enable live payments later: set `PAYMENTS_ENABLED=true` + valid `STRIPE_SECRET_KEY` on Render.

Public config: `GET /api/config/public`

## How to test

### Backend smoke (no auth)
```bash
cd backend && API_URL=https://footballpro.onrender.com npm run smoke:api
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
2. Run migrations (`npm run migrate` in deploy or GitHub Action)
3. Env vars: `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `WEB_APP_URL` (mobile calls)
4. **Do not set** `PAYMENTS_ENABLED=true` until launch
5. Verify: `curl https://footballpro.onrender.com/api/config/public`
6. Verify: `curl https://footballpro.onrender.com/api/streams`

## Known limitations (honest)

1. **RTMP ingest server** — OBS stream key shown; nginx-rtmp not on Render (optional). In-app broadcast uses **LiveKit** (web embed) or **YouTube** parallel stream.
2. **Push notifications on mobile** — API ready (`POST /api/profiles/me/push-token`); requires `expo-notifications` in EAS build.
3. **Dual live APIs** — `/api/streams` (primary) + legacy `/api/live-stream` (web profile); unified long-term.
4. **i18n** — Web has locales; mobile English/Albanian mix in UI strings.

## What was completed in this push

- Payments guard (`backend/config/payments.js`)
- Public config endpoint
- Push token route
- Tournament participant accept/reject (mobile)
- Knockout bracket + round advance
- Stream–User association fix
- ClubStaff enum migrations
- Mobile standings fix, SafeArea white screen fix
- API smoke script + npm scripts

## Next polish (optional, post-launch)

- EAS production build with push notifications
- Consolidate live-stream APIs
- Dark mode persistence (mobile)
- E2E tests (Detox / Playwright)
- Enable Stripe when legally/commercially ready

---

*2 years of work — this document marks the **1.0 feature-complete** line. Payments stay off by design until you flip the switch.*
