# Production Readiness Checklist

This checklist records audit evidence, not release approval.

## Stop before child-safety pilot

- [ ] Fix athlete API privacy/IDOR; test non-owner and pending minor.
- [ ] Fix socket call signaling; require server-owned active call and participant-derived recipients.
- [ ] Remove writes from public roster GET; test GET is side-effect free.
- [ ] Restrict `/club-members/athlete/:athleteId` to the athlete/guardian/assigned club/admin.
- [ ] Restrict pending/inactive club staff listing to authorized managers.
- [ ] Decide and implement adult-to-minor messaging/calling safeguards; document the policy.
- [ ] Decide acceptable guardian verification level; current email attestation is not independent identity proof.
- [ ] Secure private/minor media at Cloudinary delivery layer and test URL revocation/access.
- [ ] Verify account deletion for all related services and retention exceptions.

## Stop before enabling payments

- [ ] Atomically claim unique provider transaction and fulfill premium/JonCoin in one idempotent transaction.
- [ ] Require exact Apple bundle/product/transaction claims and supported signed-transaction shape.
- [ ] Verify Google package, product, token state, expiry, acknowledgement and refund/revocation flow.
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
- [ ] Backend test suite green in a network-enabled CI runner. Current sandbox run: 240/244; three loopback tests failed `EPERM`, one upload-magic assertion failed.
- [ ] Backend lint clean. Current run: 272 errors.
- [ ] Frontend lint; current run: 5 errors / 146 warnings in `frontend/src/components/ClubRoster.jsx` (managed athlete form state is unused/undefined).
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
