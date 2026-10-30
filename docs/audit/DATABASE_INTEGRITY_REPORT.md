# Database Integrity Report

**Limit:** Source/migration inspection plus disposable local integration databases. No production PostgreSQL connection or schema introspection was performed; production constraints and migration status remain unverified.

## Latest verification — 2026-10-30

Three isolated local PostgreSQL clusters were initialized solely for test runs, then stopped and removed. The first two exercised athlete privacy, guardian-consent filtering, call recipient checks, read-only club roster behavior, and the athlete-membership route under public, verified-club, active-coach and inactive-coach identities. The third used Sequelize's `IapPurchase` model with the migration's unique-index definition and confirmed that simultaneous claims for one transaction commit exactly one row. No project/local/production DB was used or modified, and no migration was run. This does not prove the index is present in production.

## Entity and write-path review

| Entity | Observed structure | Integrity concern / required verification |
|---|---|---|
| Users / Profiles | User role, DOB, parent flags; Profile contains contact/privacy JSON, stats/career/media JSON | Unique email is model-declared; verify case-insensitive uniqueness in actual DB. Profile's `userId` has no visible `allowNull:false` or unique declaration in model excerpt. Ensure one Profile per user and DB not just application-level. |
| ClubMember | FK references to club/athlete, provenance, status, team/category/group/number | GET paths no longer create or update ClubMember rows; the athlete membership list also filters private states by relationship. Verify both FKs, unique `(clubId, athleteId)` or temporal membership policy, jersey/status constraints and cascade behavior in the live schema. |
| ClubStaff | club/staff IDs, role, team, status, contract dates | Verify FKs and constraints for duplicate active assignments, valid role/status, expiry and leftAt. Coach authorization helper checks active, allowed coaching role, non-expired contract. |
| GuardianConsent | minor/guardian IDs, guardian contact, scope/version, hashed one-time/management tokens and timestamps | Verify unique token hashes and FK/index in deployed schema. No independently verified guardian identity evidence was found beyond email possession and declaration. |
| Conversations / Members / Messages | conversation membership used for authorization and sockets | Verify unique membership pair, FK constraints, delete/retention policy, and that every message/call write requires membership. |
| Match / MatchScorer / MatchEvent / PlayerMatchStat | services reconcile results, events, standings and player totals | Several sources can represent goals/cards; protect one authoritative event source and run reconciliation. Profile stats sync occurs outside core transaction in some paths. Verify unique `(matchId,userId)` and valid team/player references. |
| IapPurchase | transactionId unique index in migration and purchase record fields | Disposable PostgreSQL concurrency check confirmed unique-index arbitration yields one committed claim. Verify the production migration ledger/index; the disposable check does not establish production state. |
| Wallet/ledger/orders | ledger service and transaction tests | Unit tests show idempotency/locking at service level; inspect deployed unique indexes, FK and reconciliation jobs before launch. |

## Resolved data consistency defect

The profile-name fuzzy import was removed from `GET /api/club-members/club/:clubId` in commit `df8cdec`. Existing `ClubMember` rows remain the roster source; no data was deleted or backfilled. Regression checks confirm GET does not call ClubMember write methods and the local PostgreSQL route test preserved membership row count. If a legacy import is needed later, use a reviewed, deterministic, auditable job rather than name-substring matching.

## Required read-only schema verification before production approval

Use a sanitized schema-only dump or a read-only connection in a separately authorized environment to verify:

- applied migration ledger matches repository migration order;
- unique constraints and indexes for email, profile user, membership pairs, guardian token hashes, IAP transaction IDs, ledger idempotency keys and event dedupe keys;
- FK `ON DELETE`/soft-delete implications and retention obligations;
- enum/check constraints for roles, status, team type, squad group, amount and currency;
- query plans/indexes for membership, consent and conversation ACL lookups.

Do not run `sync({ alter: true })`, seeders, destructive scripts, or migrations against production as part of an audit.
