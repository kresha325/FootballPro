# Backend Architecture Review

**Scope:** Static review of the current Express/Sequelize backend. No DB or deployed service was queried.

## Latest verification — 2026-10-30

The former P1 findings for legacy athlete serialization, direct-call socket signaling, and roster GET writes are fixed on branch `fix/xtalenti-v1-p1-security` (commit `df8cdec`). A disposable local PostgreSQL integration test exercised those changes; it was dropped after the run. The athlete-membership enumeration finding is also fixed in the current working tree and passed route tests against a second disposable PostgreSQL cluster. Neither change is deployed or merged into `main`.

Remaining verified architectural risks include duplicated HTTP call-start flows (`videoCalls.js`), non-atomic IAP fulfillment, the public club-staff endpoint accepting arbitrary status filters, and projections that run after core match transactions. The full backend suite still has the unrelated `upload-magic` fixture failure; changed-file lint is clean.

## Observed architecture

- Express mounts route modules under `/api`; JWT auth middleware resolves the account from the database per request, checks token version and account ban/deletion, and applies parental gating to most API routes (`backend/middleware/auth.js`). Socket.IO uses separate JWT middleware (`backend/middleware/socketAuth.js`) and checks user status/parental restrictions before connection.
- Sequelize models and migration files coexist with service/controller logic. Important domains include Users/Profiles, clubs/staff/memberships, tournaments/matches/events/stats, messaging/calls, streams/LiveKit, reports/blocks, orders/wallet/payments/IAP.
- Primary streaming/calling uses LiveKit (`backend/controllers/livekit.js`, `backend/utils/livekitAcl.js`); `mediasoup-server/DEPRECATED.md` marks the legacy service deprecated.
- `backend/server.js` mounts both messaging routers at `/api/messaging` and `/api/messaging/unread`; these route namespaces should be covered by route inventory tests to prevent accidental shadowing.
- Backend package `start` invokes `npm run migrate:deploy` before `server.js`; this means deploy startup is migration-capable. It was not run in this audit.

## Strengths

- Authenticated HTTP handlers often use centralized `auth`/`protect`; admin routes have RBAC permissions.
- Match/competition service contains lifecycle, score, fixture, standings and player-side validation helpers. Some official-result work is transactional.
- Ledger operations have idempotency/concurrency tests; store receipt validation has Apple JWS and Google Publisher API implementations.
- Upload middleware has file-size/type checks; dedicated tests cover suspicious extensions and magic-byte behavior, though one current test fails.
- Guardian consent uses hashed tokens and state transitions with transaction/row locking in verification and revocation paths.

## Architectural risks / verified issues

1. Legacy athlete profile privacy now delegates to the canonical field-visibility rules, but other profile serializers still need a parity audit.
2. Direct-call signaling authorization is centralized in `backend/utils/callSignaling.js`; group room membership and call start/end lifecycle still need device E2E testing.
3. `backend/controllers/videoCalls.js:126-230` implements separate `createVideoCall` and `startCall` flows with duplicated block checks, duplicate-call lookup, record creation and notification logic. A shared internal call-start service could reduce policy drift while preserving both public endpoints. This is a recommended refactor, not yet changed.
4. Club roster GET no longer imports memberships. Athlete membership reads now scope pending/rejected states to the athlete, verified guardian, admin, verified club, or active authorized coach; continue auditing other GET handlers for writes.
5. IAP verification and fulfillment are sequential but not one atomic transaction. `transactionId` uniqueness is checked before fulfillment; concurrent requests can race. Wallet and purchase records must commit together under a unique transaction claim/lock.
6. Some best-effort sync/notification logic runs after core transactions (competition statistics/profile reconciliation). Treat projections as repairable derived state, expose reconciliation metrics, and keep authoritative score/event transaction atomic.
7. Repository tests combine pure unit tests with loopback server tests. The complete suite now runs when local listener permissions are available; the current remaining failure is the unrelated PNG fixture assertion in `tests/upload-magic.test.js`.

## Official match authority compatibility map

Current helper `backend/utils/matchPermissions.js` and `backend/services/competitionService.js` allow tournament creator/admin operations, with liga-managed tournament restrictions. The route/controller surface includes score updates, goal/scorer events, lineups, stats, and result lifecycle. Team-only publication would affect these roles and existing tournament workflows. This is a product-policy change, not a low-risk code cleanup; obtain approval and specify whether Team means platform operator, club, league, or another authority before implementation.

## Recommended target structure

- Route layer: parse/validate input, authenticate, attach object-scoped permission middleware.
- Domain services: single policy functions for guardian state, profile visibility, call participants, roster authority, competition authority, and purchase fulfillment.
- Persistence: transactions for cross-model state changes; explicit unique constraints and FK constraints in migrations; avoid writes in GET.
- Serialization: one canonical public/private/club/admin DTO per entity with field allowlists; avoid serializing Sequelize models directly.
- Audit: append-only actor/action/object/result logs for high-impact admin, consent, payment and moderation transitions; monitoring for failed audit persistence.
- Tests: permission matrix tests at route/service boundary, plus contract parity checks across web and mobile callers.
