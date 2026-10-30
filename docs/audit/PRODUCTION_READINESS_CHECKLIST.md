# Production Readiness Checklist

This checklist records audit evidence, not release approval.

## Stop before child-safety pilot

- [x] Fix athlete API privacy/IDOR; tests cover non-owner, consented and pending minor. Branch `df8cdec`.
- [x] Fix socket call signaling; active call and participants are server-validated, recipient is derived, block lookup fails closed, and call offers cannot create conversations. Tests cover spoofing, non-party, rate limit and allowed signaling.
- [x] Remove writes from public roster GET; regression and disposable-PostgreSQL tests confirm existing memberships are preserved.
- [x] Restrict `/club-members/athlete/:athleteId` to owner/guardian/admin/verified club/active assigned coach for private states; other viewers retain approved affiliations. Commit `be5362b` is pushed to the security review branch; helper, route-handler and disposable-PostgreSQL tests cover access.
- [x] Restrict pending/inactive club staff listing to the verified owning club or platform admins; public reads show current active staff only. Commit `4697599` is pushed to the review branch; six route-handler regression tests pass.
- [x] Require a verified, active club account before exposing its private pending/rejected membership requests; unverified clubs retain public visibility of approved rosters only. Route-level tests cover both outcomes.
- [ ] Decide and implement adult-to-minor messaging/calling safeguards; document the policy.
- [ ] Decide acceptable guardian verification level; current email attestation is not independent identity proof.
- [ ] Secure private/minor media at Cloudinary delivery layer and test URL revocation/access.
- [ ] Verify account deletion for all related services and retention exceptions.
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
