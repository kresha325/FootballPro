# Web / Mobile Parity Matrix

**Method:** Compared route/API helpers and feature modules statically. A matching helper or screen is **surface parity**, not proof of identical runtime behavior. Mobile static parity script passes; production API/device end-to-end tests were not available.

| # | Domain | Web | Mobile | Backend contract / assessment |
|---:|---|---|---|---|
| 1 | Authentication | API helpers + AuthScreen | API helpers + auth screens | **PARTIAL PARITY** — shared API; role/guardian error scenarios not E2E-tested. |
| 2 | User profiles | profile helpers/screens | profile helpers/screens | **BROKEN** — canonical privacy serializer exists, but legacy athlete API returns full Profile to other authenticated users. |
| 3 | Clubs | club/profile components | club/profile screens | **PARTIAL PARITY** — shared backend; club verification/ownership flows not E2E-tested. |
| 4 | Coaches and staff | staff/roster views | roster/admin surfaces | **PARTIAL PARITY** — same data model; endpoint exposes pending/inactive staff publicly. |
| 5 | Athletes and rosters | ClubRoster + managed form | ClubRosterScreen + managed form | **PARTIAL PARITY** — both call server-managed flow; GET roster side effect must be removed before relying on consistency. |
| 6 | Federations and leagues | API and competition views | API and league/tournament views | **NOT VERIFIED** — static endpoint breadth; role and lifecycle parity not exercised. |
| 7 | Tournaments | tournament components | TournamentDetailScreen | **PARTIAL PARITY** — static parity module check passes; real enrollment/admin/fixture workflows not E2E-tested. |
| 8 | Matches | Matches/MatchCenter | tournament match screens | **PARTIAL PARITY** — shared backend; separate score/event flows need consistency tests. |
| 9 | Statistics | match/profile/analytics views | match/profile screens | **NOT VERIFIED** — official source/recalculation consistency not confirmed across clients. |
| 10 | Media and gallery | gallery/upload components | gallery/upload screens | **PARTIAL PARITY** — similar endpoint surface; private media/Cloudinary access control not verified. |
| 11 | Analytics | admin/analytics views | admin dashboard | **NOT VERIFIED** — aggregation and permissions not compared end-to-end. |
| 12 | Gamification | points/badges components | XPNotificationManager/screens | **PARTIAL PARITY** — mobile static check passes; event delivery/data parity untested. |
| 13 | Messaging | Messaging component | MessagingScreen | **PARTIAL PARITY** — shared HTTP/socket service; member checks present, adult/minor policy and device reconnect unverified. |
| 14 | Video calls | VideoCallManager/Room/Simple | Incoming/Outgoing + NativeCallRoom | **BROKEN** — server signaling recipient checks incomplete; mobile parity static script passes but does not test ACL. |
| 15 | Scouting | Scouting views | scouting modules/screens | **NOT VERIFIED** — full flows and payload equivalence not tested. |
| 16 | Scouting reports | report forms/views | mobile surface/API | **NOT VERIFIED** — no end-to-end create/read/permission comparison. |
| 17 | Feed and posts | Feed components | FeedScreen | **PARTIAL PARITY** — shared API helpers, upload/moderation behavior not E2E-tested. |
| 18 | Stories | story components/API | mobile story modules if present | **NOT VERIFIED** — no feature-specific E2E evidence gathered. |
| 19 | Likes, comments, follows | web feed/profile interactions | mobile feed/profile interactions | **PARTIAL PARITY** — API helpers exist; blocking/privacy and edge cases not compared. |
| 20 | Marketplace | product/cart/order pages | partial client/screens | **NOT VERIFIED** — complete purchase/fulfillment UI flow not exercised. |
| 21 | Wallet / JonCoin | wallet pages/helpers | wallet API/screen surface | **PARTIAL PARITY** — backend ledger tests pass; client state/reconciliation not device-tested. |
| 22 | Premium / subscriptions / IAP | Premium/payment pages | PremiumScreen + expo-iap | **PARTIAL PARITY** — mobile digital purchases intentionally disabled by release config; no store sandbox test. |
| 23 | Notifications | web notifications | Expo notifications | **NOT VERIFIED** — source exists; provider/device delivery not exercised. |
| 24 | Search and discovery | GlobalSearch/profile discovery | profile/search modules | **NOT VERIFIED** — query/result/visibility parity not tested. |
| 25 | Moderation and support | report/block/settings surfaces | report/block/settings surfaces | **PARTIAL PARITY** — backend paths exist; response SLA and client flow parity not verified. |
| 26 | Admin and feature flags | AdminShell/pages | AdminDashboard | **PARTIAL PARITY** — role/UI surface differs; API permission matrix and mobile scope not fully verified. |


## Checks run

- Mobile `npm run verify:parity`: passed all static module string checks.
- Mobile `npm run release:preflight`: passed.
- Frontend Vite build: passed with a >500 kB chunk warning.
- No UI automation, browser E2E, native simulator run, store sandbox purchase, or real-device test was run in this audit.

## Required parity tests before pilot

For each high-value flow, run the same request/role cases through web and mobile clients against a disposable seeded database: registration and parent pending/revoked, profile privacy, club/coach roster, tournament enrollment/results, match scoring and scorer events, blocked messaging/calls, media upload/view/delete, notifications, account deletion, and paused payment behavior. Assert identical status codes, sanitized DTOs, and state transitions; do not assert only that API helper names exist.
