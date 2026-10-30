# Guardian consent events and protected media rollout

This rollout intentionally does not run against production from the development workspace.

## Migration ordering and compatibility

`20261030150000-create-guardian-consents.js` creates `GuardianConsents`; `20261030170000-create-guardian-consent-events.js` depends on it; `20261030210000-add-managed-athlete-audit.js` follows both; `20261030230000-repair-guardian-event-indexes-add-gallery-public-id.js` is the additive repair and Gallery `publicId` migration. Sequelize applies these lexically ordered migrations before `server.js` starts because `npm start` runs `npm run migrate:deploy` first. `server.js` authenticates the database but does not synchronize model schemas.

The audit-event table uses restrictive foreign keys for consent/minor rows and `SET NULL` for the optional actor. Do not roll back by dropping that table. The original event migration's `down` refuses to remove audit history. The repair migration's `down` is intentionally a no-op, retaining the table, indexes, and Gallery column when application code is rolled back. Gallery's nullable `publicId` is additive and does not rewrite existing rows. Existing installations with complete migrations see a no-op for the two indexes and only the additive nullable column.

## Read-only production checks (operator runs these in Render/psql)

Use a read-only connection/transaction. Do not print guardian email, names, token hashes or consent metadata.

```sql
BEGIN TRANSACTION READ ONLY;

SELECT name
FROM "SequelizeMeta"
WHERE name IN (
  '20261030150000-create-guardian-consents.js',
  '20261030170000-create-guardian-consent-events.js',
  '20261030210000-add-managed-athlete-audit.js',
  '20261030230000-repair-guardian-event-indexes-add-gallery-public-id.js'
)
ORDER BY name;

SELECT table_name, column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name IN ('GuardianConsents', 'GuardianConsentEvents', 'Gallery')
ORDER BY table_name, ordinal_position;

SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = current_schema()
  AND tablename = 'GuardianConsentEvents'
ORDER BY indexname;

SELECT conrelid::regclass AS table_name, conname, confrelid::regclass AS referenced_table,
       confdeltype
FROM pg_constraint
WHERE conrelid = '"GuardianConsentEvents"'::regclass AND contype = 'f'
ORDER BY conname;

SELECT count(*) AS guardian_consent_event_count FROM "GuardianConsentEvents";
ROLLBACK;
```

The expected foreign-key delete actions are `r` (RESTRICT) for `GuardianConsents` and minor `Users`, and `n` (SET NULL) for actor `Users`. If a migration is absent, a required column/index is absent, or the FK action differs, stop the deploy and repair on a backup/restorable staging clone first. Never manually edit `SequelizeMeta` to disguise schema drift.

## Media rollout and legacy URLs

New private/follower Gallery items, private Videos and media uploaded by an athlete awaiting guardian approval use Cloudinary `authenticated` delivery. Existing authorized routes continue returning URL strings; the response middleware signs only authenticated Cloudinary URLs for 15 minutes and disables HTTP caching. Public `/upload/` URLs remain untouched for media explicitly published as public.

Guardian withdrawal and account deletion try to convert that user's existing Cloudinary upload assets with `invalidate: true`, then update URL fields in Post, Gallery, Video, Stream, LiveStreamReplay and Profile. Local `/uploads/` files and YouTube assets are unchanged. Conversion failures are logged and require operator retry. Cloudinary invalidation propagates but is not instantaneous; copies/downloads already made by other parties cannot be recalled. For strict takedown, review Cloudinary delivery analytics/support and use a separately approved incident procedure.

Before rollout, on a disposable/staging Cloudinary account verify: account plan allows authenticated delivery for image/video; the SDK's private download URL works for each resource type; native video playback can complete within 15 minutes; thumbnails/transforms work; invalidation is accepted; and legacy asset conversion with the same public ID behaves as expected. For shared public IDs, do not convert an asset until all references have been checked, because changing delivery type affects every consumer of that Cloudinary asset.

Deployment order: take a restorable database backup; deploy backend and let additive migrations finish; verify read-only schema queries; validate media access with test accounts; run the backfill first without `--apply` against a read-only database credential; inspect shared Cloudinary asset references and expected counts; only then run reviewed `--apply` batches under an operator-approved maintenance window. The script protects `NODE_ENV=production` apply behind `CONFIRM_PRODUCTION_MEDIA_BACKFILL=YES`; do not set that flag until the inventory and shared-reference review are complete. No production migration, Cloudinary conversion or deploy was run for this change.

## Release blockers requiring manual validation

- The current implementation signs authenticated media through Cloudinary's time-limited private-download API. Cloudinary documents that these URLs are not CDN-cached and cost twice the delivery bandwidth; verify web image rendering, React Native image loading, video playback/seeking, range requests, and the 15-minute expiry against the XTALENTI Cloudinary plan before pilot.
- A signed URL is a bearer link until its 15-minute expiry. Revocation blocks future app-issued links and changes the asset to authenticated, but copies already downloaded and CDN copies during invalidation propagation cannot be recalled.
- The dry-run backfill must be reviewed for assets reused across unrelated public records or external pages before apply. Changing a Cloudinary asset's delivery type affects that asset globally. Resolve any shared-reference conflicts by creating a separate authenticated copy and updating only the restricted references.
- Parent withdrawal/account deletion restricts application record visibility immediately. If Cloudinary conversion fails, the old raw URL can remain publicly retrievable; alert/log review and a retry are required before treating cleanup as complete.
