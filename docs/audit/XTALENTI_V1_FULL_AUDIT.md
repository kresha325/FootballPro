# XTALENTI V1 — Full Backend, Security, and Web/Mobile Audit

**Audit date:** 2026-10-30
**Scope:** Current working tree in `/Users/kresha/Projects/footballpro`; static source review and repository tests/build checks. No database connection, migration, production request, deployment, or data mutation was performed.
**Confidence labels:** **Verified** = directly reproducible from source or an executed repository check; **Partial** = source indicates behavior, but an end-to-end production/device check was not available; **Not verified** = repository does not contain enough evidence. Severity ranks impact if the path is reachable, not exploit likelihood.

## Executive summary

XTALENTI has broad feature coverage and several useful safeguards already in place: JWTs resolve to live database users and token versions, parental authorization gates many authenticated routes, club-managed minors begin pending, LiveKit authorizes its supported room types, purchase verification exists, wallet operations have a ledger, moderation includes report/block/delete paths, and mobile static parity/release checks pass.

This audit does **not** establish production readiness. Three verified high-priority authorization/data-integrity issues need remediation before a child-safety pilot:

1. **P1 — legacy athlete API bypasses profile privacy and object-level authorization.** Authenticated users can read a specified athlete profile, including unrestricted Profile JSON. The list-all controller exists, but its `GET /` route is likely shadowed by the earlier optional `GET /:id?` route; do not claim that collection route is reachable without a route-level reproduction. `backend/routes/athlete.js:27-30`, `backend/controllers/athlete.js:33-47,75-85`.
2. **P1 — WebRTC socket signaling trusts client-chosen recipients for offer/ICE/reject/end.** Call membership is checked for `call:answer` only; other signaling events can address arbitrary user rooms and create fallback call/conversation records. `backend/server.js:768-865,932-970`.
3. **P1 — public optional-auth roster GET mutates roster state.** A GET request can create pending ClubMember rows based on a fuzzy Profile.club string match; this is an unauthenticated state-changing endpoint and can create false affiliations. `backend/routes/clubMembers.js:73-144`.

Additional verified gaps include overbroad membership reads, profile privacy inconsistencies in compatibility APIs, and unverified adult-to-minor DM safeguards. Payment checks are substantial, but IAP fulfillment has a concurrency/idempotency gap that requires a transactional claim before pilot billing. See [SECURITY_AND_PAYMENTS_REVIEW.md](SECURITY_AND_PAYMENTS_REVIEW.md).

**Official-stat publication policy:** Current tournament authorization permits the tournament creator and admins to manage official match outcomes/statistics, with special league checks. A proposed XTALENTI-Team-only policy changes product authority and may affect club/federation workflows and historical tournament administration. It is documented as an approval-dependent policy decision, not changed here.

## Verified findings

### P1 — athlete profile endpoints bypass privacy / object access

**Evidence:** `GET /api/athletes/:id?` and `GET /api/athletes/` require authentication only. `getAthlete` returns the complete Sequelize Profile row (including `contact`, `privacy`, and other JSON fields); `getAllAthletes` returns every Profile with no consent or privacy filtering. The dedicated profile controller has explicit privacy shaping and pending-minor filtering, but the legacy athlete controller does not.

**Reproduction:** With any valid non-admin JWT, call `GET /api/athletes/{another-athlete-id}` to receive full Profile JSON. The parameterized endpoint is directly reachable. The collection controller is present but route order may shadow it; this is a confirmed route-design defect candidate, not a confirmed reachable data exposure.

**Impact:** Exposure of private contact/profile fields and potentially pending-minor profiles; cross-account IDOR.
**Affected:** `backend/routes/athlete.js:27-30`; `backend/controllers/athlete.js:33-47,75-85`; `Profile` fields at `backend/models/Profile.js:12-66`.
**Minimal remediation:** Remove/retire legacy endpoints if unused, or enforce owner/admin/object permissions and reuse the same privacy/guardian-consent serializer as `controllers/profiles.js`. Add cross-user/minor tests first; preserve public sports profile visibility and match/tournament data.

### P1 — socket call signaling has no participant check for most events

**Evidence:** `call:answer` resolves a VideoCall and verifies that the authenticated socket user is caller or receiver (`backend/server.js:867-930`). `call:offer` trusts body `to`, may create a new VideoCall and direct conversation, then sends an incoming-call event (`:768-865`). `call:ice-candidate`, `call:reject`, and `call:end` also forward to body `to` without resolving/authorizing `callId` or participant membership (`:932-970`). Block status is checked only on offer and its lookup failure is treated as non-fatal.

**Reproduction:** Connect with a valid JWT, emit `call:reject` or `call:ice-candidate` with another user's ID as `to`; server forwards the event to that user's private socket room. For offers, send a `to` value and no callId; server attempts to create a call record. This is source-confirmed; a live socket exploit was not run.

**Impact:** Call spam/signaling injection, arbitrary WebRTC signaling delivery, and creation of calls/conversations without an authorized call workflow. This is particularly sensitive where adult/minor contact restrictions are absent.
**Affected:** `backend/server.js:768-970`, `VideoCall` model.
**Minimal remediation:** Require a server-created active VideoCall ID on all signaling; verify authenticated user is one party, derive recipient server-side, apply reciprocal block/minor communication policy, validate payload shape/size, and make calls to nonexistent IDs fail closed. Add socket-level tests for forged recipient, non-party, blocked pair, guardian-pending minor, and valid party flows.

### P1 — GET roster endpoint writes inferred memberships

**Evidence:** Optional-auth `GET /api/club-members/club/:clubId` performs fuzzy text matching on Profile.club, then inserts pending ClubMember rows when no row exists (`backend/routes/clubMembers.js:73-144`). The write is independent of caller identity and happens during a read.

**Reproduction:** Call the public GET for a club whose Profile.club substring matches another athlete's Profile.club. The code inserts a pending membership for that athlete. No request body or authorization is needed.

**Impact:** A public read can mutate roster state, create incorrect club-athlete associations, and pollute subsequent roster/tournament workflows.
**Minimal remediation:** Remove writes from GET. If legacy roster import is required, run a one-time reviewed admin job with deterministic exact club IDs, audit records, and dry-run output; do not infer links from a name substring.

### P2 — athlete membership list exposes other users' memberships to any authenticated user

**Evidence:** `GET /api/club-members/athlete/:athleteId` uses `protect` but does not require `req.user.id === athleteId`, guardian, club assignment, or admin; returns all ClubMember states and club identities (`backend/routes/clubMembers.js:206-237`).

**Impact:** Pending/rejected affiliation and transfer history can be enumerated.
**Minimal remediation:** Check owner, authorized guardian, assigned club staff for that specific athlete, or admin; return only approved public affiliations to other viewers. Tests should cover pending/rejected versus approved.

### P2 — admin managed-athlete form state was attached to the wrong component (fixed locally)

**Evidence:** `frontend/src/components/admin/pages.jsx` declared `showManagedAthleteForm` inside `BulkUsers`, but referenced it from `UsersPage`. This produced two unused-state and three undefined-variable ESLint errors, and would fail when the admin Users page renders the managed-athlete action. The state was moved into `UsersPage` while auditing; the UI/API contract is unchanged.

**Status:** Locally fixed; rerun lint/build results are recorded below. No commit or push was performed.

### P2 — club staff listing accepts caller-provided status without authorization

**Evidence:** `GET /api/club-staff/club/:clubId` has no authentication middleware and directly applies caller-supplied `status` and `teamType` filters (`backend/routes/clubStaff.js:19-66`). It exposes public roster staff names/roles/gender/photo, including pending/inactive records if requested.

**Impact:** Private operational state (pending/inactive staff membership) is disclosed.
**Minimal remediation:** Anonymous requests should see only active public staff; require club/admin authorization for pending/inactive states. Do not change active public staff discoverability.

### P2 — athlete profile privacy is applied inconsistently

**Evidence:** The profile system has `privacy` and explicit output shaping for profiles/list/CV paths (`backend/controllers/profiles.js:1652-1711` and related serializers). The legacy athlete endpoints return Profile directly (`backend/controllers/athlete.js:33-47,75-85`) and do not call that policy.

**Minimal remediation:** One canonical serializer and authorization policy for all profile-returning endpoints. Make tests assert the same contact/date-of-birth/guardian rules across web, mobile, and legacy APIs.

## Child-safety controls observed

- Public registration rejects explicit `role: athlete` and rejects missing roles rather than defaulting (`backend/controllers/auth.js:22-55`). Registration of other roles accepts birth date only for individual profiles; the explicit guardian gate applies to athlete minors.
- New managed athlete registration requires a verified club, active coach assignment with allowed coaching role and non-expired contract, or admin `players.manage`; uses a Sequelize transaction and random unusable credentials (`backend/utils/managedAthleteRegistration.js:105-129`, `backend/controllers/managedAthletes.js:34-212`). Current working-tree changes are not committed and must be separately reviewed before release.
- Managed athletes under 18 start with `parentVerified=false`, pending ClubMember status, and guardian email request; consent is not granted by the club (`managedAthletes.js:165-212`). Middleware denies most routes while pending (`backend/utils/parentalAuthorization.js:23-49`).
- Consent workflow records purpose/scope/policy version, hashes expiring token, requires a guardian attestation and relationship, supports withdrawal via a separate management token, invalidates sessions, and removes managed athlete from active rosters while retaining match/tournament history (`backend/controllers/verification.js:251-335,342-405`).
- **Missing evidence:** Email possession plus self-attestation does not independently prove legal guardianship. No identity/provider check or human escalation evidence was found. Treat it as an attested email workflow, not verified identity/relationship.
- **Missing evidence:** There is no demonstrated adult/minor communication rule beyond global parental-pending gating and mutual block checks. No verified finding that consenting minors are barred from adult DMs/calls; require policy decision and explicit age-based tests.

## Data, reporting, audit, and media

- `ClubMember` has foreign-key references in the model and registration provenance fields (`backend/models/ClubMember.js:11-33`), but model declarations alone do not prove production DB constraints; production schema was not queried.
- `GuardianConsent` stores hashed verification/management tokens and has an index for minor/state (`backend/models/GuardianConsent.js:4-34`). No database was inspected, so migration application/index correctness is unverified.
- Cloudinary uploads use default uploader delivery and save regular secure URLs (`backend/middleware/uploadCloudinary.js:142-190`, `backend/controllers/profiles.js:1248-1284`). No `access_mode: authenticated/private` was found in the upload paths searched. **Verified:** delivered media URLs are conventional Cloudinary URLs. **Not verified:** whether production Cloudinary account configuration adds global access controls. Minor media should not rely solely on API filtering if URL remains public/cacheable.
- Reporting supports posts, comments, profiles, messages, live, and users; message reports require conversation membership (`backend/controllers/moderation.js:12-68`). Admin report review writes an audit event but audit failure is swallowed (`:192-218`).
- Blocking is directional and call checks query both directions (`moderation.js:225-236`); verify every messaging/call/media path applies it consistently. Account deletion is mounted at `DELETE /api/moderation/account`; implementation is in `backend/controllers/accountDeletion.js` and needs a data-retention/third-party media deletion review before launch.

## Tests and checks executed

- Backend `npm test`: **240 passed / 244 total; 4 failed.** Three tests could not bind `127.0.0.1` (`EPERM` in this sandbox): `tests/oauth-exchange.test.js`, `tests/phase6-livekit-football.test.js`, `tests/rate-limit-proxy.test.js`. `tests/upload-magic.test.js` failed independently: its real-PNG assertion returned `false` where `true` was expected. No changes were made to tests.
- Backend `npm run lint`: **failed, 272 ESLint errors** across the existing backend, including unused variables and control-regex lint. New uncommitted `managedAthletes.js` also has an unused `TEAM_TYPES` constant.
- Frontend `npm run build`: **passed**; Vite emitted a large-chunk warning (largest entry about 924 kB minified, LiveKit chunk about 503 kB). Frontend `npm run lint`: initial run found 5 errors / 146 warnings in `frontend/src/components/admin/pages.jsx`; the confirmed misplaced state was fixed locally by moving its hook to `UsersPage`. A final lint run was started after the fix; see final run result below.
- Mobile `npm run verify:parity`: **passed all static checks**. This verifies source tokens/modules only, not end-to-end feature behavior.
- Mobile `npm run release:preflight`: **passed** including identifiers, production API URL, disabled payment flags, legal/deletion UI, syntax, and smoke checklist. No native device/build was performed.
- Frontend final `npm run lint`: **passed with 0 errors / 146 warnings** after moving the admin form state. Frontend final `npm run build`: **passed** with the existing large-chunk warning.
- No integration against production, real store receipts, Cloudinary, LiveKit, mail, or production PostgreSQL was performed.

## Prioritized implementation plan

1. **Before child-safety pilot (P1):** close socket signaling recipient/participant authorization; remove side effects from roster GET; consolidate athlete profile serializers/object access; restrict membership reads; validate coach/staff listing states. Do not change tournament/public sports visibility.
2. **Before payments pilot (P1):** make IAP claim/fulfillment atomic and idempotent, enforce exact signed Apple claim requirements, add concurrent duplicate receipt tests, verify product/package/transaction binding and refund/revocation handling.
3. **Before pilot (P1/P2):** decide adult-to-minor DM/call/contact policy; implement with age/consent/block checks and audit events. Obtain policy/legal review for what constitutes guardian verification.
4. **Before production scale:** implement private/signed media delivery for restricted minor assets or prove equivalent Cloudinary account policy; audit deletion propagation across Cloudinary, messages, calls, invoices, and backups; verify DB constraints from a sanitized schema dump.
5. **Product authority approval:** decide whether official stats should be Team-only, then compatibility map against creator/admin/liga/club roles, tournament ownership, score updates, match events, and historical operations. Do not implement until product owner signs off.
6. **After each patch:** targeted authorization tests, full backend tests in an environment that permits loopback, backend lint cleanup, frontend build/lint, mobile parity/preflight, and manual web+iOS+Android checks for public profiles, guardian pending/revoked, rosters, tournament enrollment/results, calls, media access, and account deletion.

## Pilot launch gate

Pilot launch should wait until the three P1 findings above are resolved and verified with automated negative authorization tests. Before any public launch, additionally verify guardian consent semantics and adult/minor contact policy, secure minor media delivery, transactional IAP idempotency, production database constraints, account-deletion propagation, and store disclosures. Preserve existing sports visibility and tournament functionality through regression tests around public active club rosters, approved athlete profiles, tournaments, match results, standings, and player stats.
