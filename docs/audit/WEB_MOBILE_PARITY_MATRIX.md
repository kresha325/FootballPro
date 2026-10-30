# Web / Mobile Parity Matrix

**Method:** Compared route/API helpers and feature modules statically. A matching helper or screen is **surface parity**, not proof of identical runtime behavior. Mobile static parity script passes; production API/device end-to-end tests were not available.

**Updated 2026-10-30:** Athlete privacy and direct-call signaling fixes are in the current branch ancestry. Managed athlete registration is connected to web/mobile screens and authenticated endpoints. New adult/minor private-contact enforcement and guardian-approval request actions are implemented locally, with backend regression coverage; no browser/device E2E or production database work was performed.

| # | Domain | Web | Mobile | Backend contract / assessment |
|---:|---|---|---|---|
| 1 | Authentication | API helpers + AuthScreen | API helpers + auth screens | **PARTIAL PARITY** — shared API; role/guardian error scenarios not E2E-tested. |
| 2 | User profiles | profile helpers/screens | profile helpers/screens | **PARTIAL PARITY** — legacy athlete API now applies canonical privacy and pending-minor filters; compare remaining profile/CV serializers and run role-based web/mobile E2E tests. |
| 3 | Clubs | club/profile components | club/profile screens | **PARTIAL PARITY** — shared backend; club verification/ownership flows not E2E-tested. |
| 4 | Coaches and staff | staff/roster views | roster/admin surfaces | **PARTIAL PARITY** — active assignment is checked for managed registration and private athlete membership states; club-staff GET still exposes caller-selected pending/inactive rows. |
| 5 | Athletes and rosters | ClubRoster + managed form | ClubRosterScreen + managed form | **PARTIAL PARITY** — managed form wiring is verified; roster GET is read-only and membership status reads are scoped, but no device workflow E2E has run. |
| 6 | Federations and leagues | API and competition views | API and league/tournament views | **NOT VERIFIED** — static endpoint breadth; role and lifecycle parity not exercised. |
| 7 | Tournaments | tournament components | TournamentDetailScreen | **PARTIAL PARITY** — static parity module check passes; real enrollment/admin/fixture workflows not E2E-tested. |
| 8 | Matches | Matches/MatchCenter | tournament match screens | **PARTIAL PARITY** — shared backend; separate score/event flows need consistency tests. |
| 9 | Statistics | match/profile/analytics views | match/profile screens | **NOT VERIFIED** — official source/recalculation consistency not confirmed across clients. |
| 10 | Media and gallery | gallery/upload components | gallery/upload screens | **PARTIAL PARITY** — similar endpoint surface; private media/Cloudinary access control not verified. |
| 11 | Analytics | admin/analytics views | admin dashboard | **NOT VERIFIED** — aggregation and permissions not compared end-to-end. |
| 12 | Gamification | points/badges components | XPNotificationManager/screens | **PARTIAL PARITY** — mobile static check passes; event delivery/data parity untested. |
| 13 | Messaging | Messaging component; approval request CTA | MessagingScreen; approval request alert | **PARTIAL PARITY** — server policy gates REST/socket paths and eligible profiles can request guardian approval; browser/device behavior and email approval E2E not run. |
| 14 | Video calls | VideoCallManager/Room/Simple | Incoming/Outgoing + NativeCallRoom | **PARTIAL PARITY** — exact channel consent and active assignment are checked before direct signaling; call lifecycle, revocation during an active call, reconnection and device behavior remain untested. |
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
- Backend full suite passed 300/300 on this local branch; focused child-contact and revocation tests passed 36/36. These tests use mocks for the new policy paths; the consent-event migration and guardian email workflow still need a disposable PostgreSQL integration run.

## Required parity tests before pilot

For each high-value flow, run the same request/role cases through web and mobile clients against a disposable seeded database: registration and parent pending/revoked, profile privacy, club/coach roster, tournament enrollment/results, match scoring and scorer events, blocked messaging/calls, media upload/view/delete, notifications, account deletion, and paused payment behavior. Assert identical status codes, sanitized DTOs, and state transitions; do not assert only that API helper names exist.
