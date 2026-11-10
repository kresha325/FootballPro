# Production Readiness Checklist

This checklist records audit evidence, not release approval.

## Latest evidence update — 2026-11-10

Remote refs fetched: `main=752af2f22d4a3f1170bbdac2fc6b075ab87dd580`; `fix/xtalenti-v1-p1-security=1d7d3c931c3a88a9fff4dffb974affe38aebc30f`. Merge-base is the security SHA and the security branch is already an ancestor of main. Current audit branch is based on that main SHA.

### Verified P0/P1 status

| Priority | Result | Evidence | Remaining action |
|---|---|---|---|
| P0 child messaging/calls/private live | Consent authorization checks exact channel, active assignment and verified club; expiry/revocation fail closed. Legacy approval grants are bounded by a new backfill migration. | Backend unit and disposable-PostgreSQL test cover active coach allow, unrelated adult deny, wrong channel deny, expired deny and revoked deny. Existing call/socket tests cover participant and consent checks. | Run browser and physical-device flows, including revocation during an active call. Decide if email attestation is enough for pilot guardianship. |
| P0 Cloudinary privacy | NOT VERIFIED. Code has authenticated delivery/restriction paths, but copied URLs, cache invalidation, account deletion, provider settings and every legacy asset were not tested against the live provider. Restriction cleanup is best-effort. | No live Cloudinary credentials/configuration test was run. | Before pilot, validate provider-level delivery and invalidation with a non-production asset, prove copied URL fails after revocation/deletion, inventory/backfill legacy assets, and implement durable retry/alerting for restriction failures. |
| P1 stats/standings | Tournament stats aggregate from the full match/scorer dataset; only `recentResults` is limited to 12. Standings GET no longer writes repairs. | Disposable PostgreSQL regression confirms 15 total/finished matches, all goals/scorers, average, top scorer, recent 12, and unchanged stored participant/entry rows after GET. | Monitor query cost on representative tournament sizes. |
| P1 group/knockout | Manual A/B `TournamentClubEntry` participants advance into an entry-backed knockout final; no synthetic negative ID leaks as public champion. | Disposable PostgreSQL integration. | Validate UI representation in web/mobile staging. |
| P1 fixture and result integrity | Tournament locking prevents duplicate start/fixture races; authorization, edit/delete audit, and score-vs-scorer consistency are checked. | Disposable PostgreSQL integration covers concurrency, unauthorized creation, audit records, and rollback of a rejected inconsistent official result. | Validate admin/liga operational audit review and result edits in staging. |
| P1 migrations | League entry migration up/down preserves realistic legacy rows, explicit nullable fields, constraints, and refuses unsafe rollback. Consent expiry backfill and audit table/FK/index migration run on disposable PostgreSQL. | Three isolated migration/service integration tests passed; full migration chain completed on disposable PostgreSQL. | Read-only compare migration ledger/schema in production before rollout. Run migration only through the approved Render release process. |

### Validation ledger — 2026-11-10

| Command/check | Result | Notes |
|---|---|---|
| `npm test` (backend) | PASS, 313 passed / 0 failed / 3 skipped (316 total) | Three database integrations are environment-gated in ordinary suite and were run separately against disposable PostgreSQL. Loopback permission required. |
| `XTALENTI_COMPETITION_TEST_DB_URL='postgres://kresha@127.0.0.1:55432/xtalenti_release_test' PGSSLMODE=disable node --test tests/competition-service-postgres.integration.test.js` | PASS, 1/1 | Includes fixture races, standings read-only, stats, manual group advancement, consent expiry/revocation and score consistency. Node `pg` concurrent-query deprecation warning appears in test. |
| `GUARDIAN_TEST_DATABASE_URL='postgres://kresha@127.0.0.1:55432/xtalenti_migration_test' PGSSLMODE=disable node --test tests/guardian-consent-postgres.integration.test.js` | PASS, 1/1 | Migration/backfill/index/FK/rollback guard on disposable DB. |
| `LEAGUE_MIGRATION_TEST_DATABASE_URL='postgres://kresha@127.0.0.1:55432/xtalenti_league_migration_test' PGSSLMODE=disable node --test tests/league-fixture-migration-postgres.integration.test.js` | PASS, 1/1 | Migration up/down and realistic legacy rows on disposable DB. |
| `npm run build` (frontend) | PASS | Existing bundle-size warning (>500 kB chunks). |
| `npx eslint . --format json` (frontend) | PASS, 0 errors / 147 warnings | Warnings are non-blocking. |
| `npm test -- --run` (frontend) | PASS, 4 suites / 9 tests | |
| `npm run verify:parity` (mobile) | PASS | Static source parity only. |
| `npm run release:preflight` (mobile) | PASS | Does not build or execute on a device. |
| `npx eslint . --format json` (backend) | FAIL, 567 files / 261 errors / 0 warnings | Changed-file lint reports 12 errors in `controllers/tournaments.js` and `services/competitionService.js`; linting these files from `origin/main` reproduces the errors. All new files pass ESLint. |
| iOS/Android device, App Store/Play sandbox, live Cloudinary provider | NOT RUN / NOT VERIFIED | Requires staging credentials/device/operator evidence. |

### Migration ordering and rollback

1. Read-only inspect production `SequelizeMeta`, relevant columns, FKs, unique constraints and indexes before deploying. Do not assume Render’s successful build means the intended schema is present.
2. Apply migration `20261110100000-support-league-entry-fixtures-and-unknown-athletes.js` before enabling manual club tournament entries. Its down migration refuses when new-format records exist; preserve these records and prefer a forward repair.
3. Apply `20261110120000-expire-minor-communication-consents.js` and `20261110130000-create-competition-audit-events.js` before new application instances rely on consent expiry/audit persistence. Both are additive and deliberately do not offer destructive down migrations.
4. Roll back application code without rolling back additive consent/audit schema. Keep payments disabled and preserve DB records.

### Release decision

**NO-GO.** Cloudinary delivery privacy/copy URL invalidation remains P0 and unverified; production migration state and device workflows are also outstanding. The detailed current matrix supersedes older unchecked statements below. No production service, database, or deployment was modified.

## Stop before child-safety pilot

- [x] Fix athlete API privacy/IDOR; tests cover non-owner, consented and pending minor. Branch `df8cdec`.
- [x] Fix socket call signaling; active call and participants are server-validated, recipient is derived, block lookup fails closed, and call offers cannot create conversations. Tests cover spoofing, non-party, rate limit and allowed signaling.
- [x] Remove writes from public roster GET; regression and disposable-PostgreSQL tests confirm existing memberships are preserved.
- [x] Restrict `/club-members/athlete/:athleteId` to owner/guardian/admin/verified club/active assigned coach for private states; other viewers retain approved affiliations. Commit `be5362b` is pushed to the security review branch; helper, route-handler and disposable-PostgreSQL tests cover access.
- [x] Restrict pending/inactive club staff listing to the verified owning club or platform admins; public reads show current active staff only. Commit `4697599` is pushed to the review branch; six route-handler regression tests pass.
- [x] Require a verified, active club account before exposing its private pending/rejected membership requests; unverified clubs retain public visibility of approved rosters only. Route-level tests cover both outcomes.
- [x] Approve and implement the private-contact rule: unrelated adults denied by default; active verified coaches require exact channel consent; scouts/managers require guardian-mediated group consent and guardian presence. REST, Socket.IO, video-call, and private-live invitation checks are in the local review branch with policy regression tests.
- [ ] Apply/review the additive `GuardianConsentEvents` migration before deploy; test consent request, approval, expiry and revocation against a disposable PostgreSQL database.
- [ ] Exercise guardian approval request from web/mobile, verify channel-specific consent, and test revocation while a call is active on browser and device.
- [ ] Decide separate safety rules for comments, follows, reactions, mentions, and connection invitations; current approval covers only private DMs, calls, and private live invitations.
- [ ] Decide acceptable guardian verification level; current email attestation is not independent identity proof.
- [ ] Secure private/minor media at Cloudinary delivery layer and test copied URL access after privacy changes, consent withdrawal, and deletion. Current stored `secure_url` values appear publicly deliverable; CDN/account settings and cache invalidation are unverified.
- [ ] Verify account deletion for all related services and retention exceptions. Current profile photo/cover references clear, but Cloudinary assets and media copied into posts/messages are not verified as removed or invalidated.
- Profile anonymization now clears the model's actual `profilePhoto` field (test-covered); Cloudinary invalidation and copied media in posts remain unresolved.

## Stop before enabling payments

- [x] IAP code now claims the unique provider transaction and fulfills Premium/JonCoin in one idempotent database transaction; Google uses verified provider `orderId`, and Apple requires exact signed claims. Focused tests and a disposable-PostgreSQL concurrent duplicate test pass. Confirm the unique index exists in production schema before launch.
- [x] Require exact Apple bundle/product/transaction claims; receipt/JWS and active subscription checks have focused tests. Live Apple sandbox verification remains required.
- [ ] Verify Google package, token state, expiry, acknowledgement and refund/revocation flow in Play sandbox; code-level orderId/product binding is regression-tested.
- [ ] Run concurrent duplicate receipt tests; assert only one credit/activation.
- [ ] Keep production Stripe/mobile digital-payment flags disabled until separate approval.

## Data integrity and tournaments

- [ ] Inspect sanitized database schema/migration ledger read-only; confirm constraints/indexes/FKs.
- [ ] Add tests for club transfer, duplicate membership, guardian revoke, match event/scorer consistency, standings and player-stat reconciliation.
- [ ] Preserve public approved sports profiles and club rosters; preserve tournament enrollment, score/result, standings and historical statistics.
- [ ] Get product approval before Team-only official-stat authority change; map all existing creator/admin/liga flows first.

## Quality gates

- [x] Frontend production build passed; bundle warning remains (>500 kB chunks).
- [x] Mobile parity static check passed.
- [x] Mobile release preflight passed; this does not build or run on native device.
- [x] Backend test suite green: latest complete run 284/284 when temporary loopback listeners were permitted. Focused account deletion test: 1/1; athlete membership route authorization: 4/4.
- [ ] Backend lint clean. Current run: 272 errors.
- [ ] Frontend lint; prior completion snapshot had 0 errors / 146 warnings after an admin managed-form state fix. Re-run before launch.
- [ ] iOS and Android simulator/device flows: auth restore, consent pending/revoke, roster, tournament result, chat/call, camera/mic, upload/playback, notifications, deletion.
- [ ] Store sandbox IAP and provider refund/revocation tests if payments are to launch.
- [ ] Verify production env/domain/secrets and monitoring in dashboards; not accessible in this code-only audit.

## Deployment safeguards

- [ ] Review migration SQL and additive/backfill strategy before applying; this audit did not run migrations.
- [ ] Deploy only after code review, approved maintenance window where appropriate, and rollback plan.
- [ ] Monitor auth denials, guardian email outcomes, call ACL denials, media access, IAP duplicate claims, DB constraint errors and moderation SLA.

## Rollback plan (release operator to complete before deploy)

- Keep the previous application artifact/revision available for immediate Render/EAS rollback.
- Review every additive migration for backward-compatible reads/writes before applying; no migration was executed in this audit. If a migration is applied, rollback should be an additive forward repair unless the down migration is proven data-preserving on a staging copy.
- Deploy behind existing flags where available; keep all payment flags off.
- On auth, roster, consent, tournament, or call regressions, revert the application revision and preserve DB rows; do not reset/restore production DB as a first response.
- Verify health, login, approved public roster, tournament read/result, guardian revoke restriction, and call ACL after rollout; monitor logs before expanding pilot traffic.
