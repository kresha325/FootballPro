# XTALENTI V1 — Completion Plan

**Last verified:** 2026-10-30
**Repository:** `kresha325/FootballPro`
**Working branch:** `fix/xtalenti-v1-p1-security`
**Production state:** No deployment or production database access performed.

## Release status

The three previously confirmed P1 defects (legacy athlete privacy, Socket.IO call signaling, and roster GET writes) are implemented in commit `df8cdec` and pushed to the security branch. They are not merged into `main` or deployed. Their regression tests pass, and an isolated PostgreSQL integration run verified profile privacy, call participant routing, and read-only roster behavior.

A further membership-list IDOR was confirmed from the older audit and fixed in commit `be5362b`, pushed to the security branch: external authenticated viewers receive approved sports affiliations only; private membership states are scoped to the athlete, an explicitly linked verified guardian, admin, verified club, or active authorized coach. Unit tests and an isolated PostgreSQL route test pass.

The upload magic-byte failure was traced to the installed `file-type` v16 API versus the newer API expected by the code. `backend/utils/uploadMagic.js` now supports both API shapes. The complete backend suite passes when loopback test servers are permitted.

This is **not a production release approval**. Adult-to-minor communication policy, restricted Cloudinary delivery, transactional IAP idempotency, production schema verification, deletion propagation, and device end-to-end tests remain release blockers or unverified controls.

## Domain tracker

| Domain | Status | Evidence / remaining work | Priority |
|---|---|---|---|
| Authentication and recovery | IMPLEMENTED BUT NOT TESTED | Auth/register/reset routes and mail integration exist; provider delivery and recovery E2E need repeatable staging tests. | P2 |
| Profiles and privacy | IMPLEMENTED BUT NOT TESTED | Legacy athlete API now applies canonical privacy and minor consent rules (`backend/controllers/athlete.js`); compare all profile/CV serializers with role matrix. | P1 |
| Clubs | PARTIALLY COMPLETE | Verification, memberships and registration flows exist; DB constraints and club ownership transfers need schema and E2E verification. | P2 |
| Athletes and rosters | IMPLEMENTED BUT NOT TESTED | Managed registration exists; roster GET no longer writes; membership status endpoint is now relationship-scoped. Verify transfers and production constraints. | P1 |
| Guardians | PARTIALLY COMPLETE | Hashed, expiring consent and withdrawal flows exist. Guardian identity/relationship proof is email attestation; guardian account linkage is not demonstrated end to end. | P1 |
| Coaches and staff | PARTIALLY COMPLETE | Active, role-limited coach assignment gates managed registration and membership-state reads; public staff endpoint now defaults to current active staff and gates non-public statuses. Full role workflow and device validation remain. | P2 |
| Federations and leagues | PARTIALLY COMPLETE | League/federation profile and competition paths exist; workflow parity and authority matrix need E2E confirmation. | P2 |
| Tournaments | IMPLEMENTED BUT NOT TESTED | Lifecycle, enrollment, fixtures and standings helpers/tests exist; run the same role workflows on web and mobile. | P1 |
| Matches | PARTIALLY COMPLETE | Results/events/lineups exist; confirm all route writes use one transaction and authorization policy. | P1 |
| Official statistics | PARTIALLY COMPLETE | Reconciliation tests exist; approve authority policy before changing who publishes official stats. | P1 |
| Analytics | PARTIALLY COMPLETE | Admin and user analytics exist; test data parity, privacy, query cost and pagination. | P2 |
| Scouting | PARTIALLY COMPLETE | Search, watchlists, reports and comparison surfaces exist; end-to-end permissions and mobile actions are unverified. | P2 |
| Messaging | PARTIALLY COMPLETE | Membership ACL and socket paths exist; adult/minor contact policy, reconnect/order and full device workflows remain unverified. | P1 |
| Video calls | IMPLEMENTED BUT NOT TESTED | Direct signaling now requires active server-owned calls, validates participants, blocks failures closed and rate-limits events. Test native/web lifecycle and group calls on devices. | P1 |
| Live streaming | PARTIALLY COMPLETE | LiveKit and stream workflows exist; production room ACL, reconnect, lifecycle and media access require staging tests. | P1 |
| Feed and posts | PARTIALLY COMPLETE | Core create/read/react/report paths exist; role visibility, moderation and client parity need E2E tests. | P2 |
| Stories | NOT VERIFIED | Feature-specific lifecycle, expiry, report/block and mobile parity evidence not yet collected. | P2 |
| Gallery and media | PARTIALLY COMPLETE | PNG magic-byte validation now passes across the installed and newer `file-type` API shapes; direct Cloudinary URLs may remain public. | P1 |
| Marketplace | PARTIALLY COMPLETE | Listing/cart/order code exists; exercise role permissions and fulfillment on web/mobile. | P2 |
| Wallet and JonCoin | IMPLEMENTED BUT NOT TESTED | Ledger/idempotency tests exist; compare client balances and run reconciliation against a disposable DB. | P1 |
| Payments and subscriptions | PARTIALLY COMPLETE | Provider verification exists, but IAP claim/fulfillment is not one atomic transaction; mobile digital payments remain disabled. | P1 |
| Gamification | PARTIALLY COMPLETE | XP, levels, badges and achievements exist; keep rewards separate from official stats and test repeat-call abuse. | P2 |
| Notifications | PARTIALLY COMPLETE | In-app/push paths exist; provider delivery, dedupe and mobile tap navigation need device verification. | P2 |
| Search and discovery | PARTIALLY COMPLETE | Search/profile discovery exists; enforce profile/media visibility on every result and compare client filters. | P1 |
| Moderation and support | PARTIALLY COMPLETE | Report/block/account deletion paths exist; moderation SLA, audit persistence and third-party deletion are unverified. | P1 |
| Administration and audit | PARTIALLY COMPLETE | RBAC and operational screens exist; verify all privileged mutations write durable audit records. | P1 |
| Localization | IMPLEMENTED BUT NOT TESTED | Nine-language catalogs and web/mobile localization exist; complete dynamic validation and screenshot review in all required locales. | P2 |

## Verified fixes and acceptance results

### Security branch `df8cdec`

- Legacy athlete detail/list endpoints use canonical profile privacy and hide pending minors without active verified guardian consent; sensitive account fields and exact DOB are not serialized. The current process records guardian email attestation; independent proof of legal relationship is not established.
- Socket `call:offer`, `answer`, `ice-candidate`, `reject` and `end` require an active `VideoCall`; sender/recipient direction is derived and checked from the stored participants. Block lookup fails closed, payload size/rates are bounded, and offers cannot create calls/conversations.
- Club roster GET no longer infers or creates memberships. Existing `ClubMember` data remains the source of roster state.
- Mobile managed-athlete form is wired to club/coach and admin screens using authenticated API helpers; parity checks guard those links.

### Follow-up commit `be5362b` (pushed to security branch)

- `GET /api/club-members/athlete/:athleteId` limits private membership states to the athlete, a linked verified guardian, admin, the verified club for that row, or an active authorized coach. Other authenticated users still see approved affiliations.
- Acceptance: 4 focused visibility tests, source-level read-only GET tests, and real Sequelize route tests against an isolated temporary PostgreSQL cluster. Temporary DB and cluster were dropped after the run.

### Current working-tree follow-up — public club staff visibility

- Public `GET /api/club-staff/club/:clubId` now defaults to current active assignments only, excludes departed/expired/malformed-contract and banned/deleted staff accounts, and refuses public requests for pending/inactive states. A verified club can inspect its own non-public states; platform admins retain operational access.
- Acceptance: 6 route-handler regression tests pass; the complete backend suite passes 265/265 with loopback listeners permitted. This follow-up is not yet committed.

## Validation ledger

| Check | Result | Limits |
|---|---|---|
| Focused security and upload regression tests | PASS, 23/23 | Includes legacy privacy, call signaling, club roster reads, membership visibility, staff visibility, and PNG validation. |
| Backend full suite | PASS, 265/265 | Requires permission for three tests to bind temporary loopback servers; all passed in the permitted run. |
| Changed backend files syntax/lint | PASS | Not equivalent to full backend lint; repository-wide lint has historical failures. |
| Frontend production build | PASS | Existing large-chunk warning remains; unrelated to this phase. |
| Mobile parity static checks | PASS | Static source checks only; does not prove device runtime behavior. |
| Mobile release preflight | PASS | No EAS/native build or device test performed. |
| Disposable PostgreSQL integration | PASS | Temporary local DB only; no production schema or migration state inspected. |

## Ordered work plan

1. **Close child/roster access paths:** review the pushed membership-list authorization fix and commit the current public staff visibility fix; extend authorization verification for guardian and coach cases through HTTP routes.
2. **Resolve child contact policy:** product/legal decision on adult-to-minor DMs, calls and comments, including whether consent enables contact or only profile/tournament access. Implement only after this rule is approved.
3. **Payments:** build atomic idempotent IAP transaction claiming/fulfillment with concurrent duplicate tests; require exact Apple signed-transaction claims and verify Google refund/revocation/acknowledgement states. Keep payment flags disabled.
4. **Media and deletion:** choose private/signed delivery for restricted minor media; test copied URL access after consent withdrawal and account deletion; map retention exceptions.
5. **Database integrity:** use an authorized read-only production schema/migration report to verify unique constraints, FKs, indexes and enum/check constraints. No sync/alter/migration in audit.
6. **Core workflow parity:** create disposable-database role matrices for managed registration, guardians, roster, tournament enrollment, match results, scouting, messaging, calls and deletion; run web and mobile API contract cases.
7. **Performance and release:** measure list pagination/query plans, media response sizes, socket listener cleanup, native memory/crash metrics, then prepare a controlled pilot checklist and rollback plan.
8. **Gamification redesign:** keep the current system stable; deliver a separate design proposal before any significant reward/achievement model change.

## Pilot launch blockers

- Adult/minor contact policy and enforcement tests are not resolved.
- Cloudinary delivery privacy and revocation behavior are not proven.
- IAP atomicity/idempotency and full provider sandbox refund cases are incomplete.
- Production database schema and applied migration ledger are not verified.
- Adult/minor contact policy and enforcement tests are unresolved.
- Native iOS/Android end-to-end flows and production-provider integrations have not been exercised.
- Several broad domains remain only statically audited; consult `docs/audit/PRODUCTION_READINESS_CHECKLIST.md` for release evidence required.
