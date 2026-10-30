# Security and Payments Review

## Authentication / authorization

- `backend/middleware/auth.js` validates a bearer JWT, reloads the User, checks token version and blocked/deleted account state, and applies parental authorization except explicit allowlisted routes. This is a positive central control.
- Admin permission tiers use `backend/services/admin/rbac.js`; missing admin tier is treated compatibly as super-admin according to tests. Each handler still needs a server-side permission check.
- Verified P1/P2 object authorization and privacy findings are listed in `XTALENTI_V1_FULL_AUDIT.md`.

## Child accounts and guardian authorization

- Public `/api/auth/register` rejects explicit athlete role and does not default a missing role (`backend/controllers/auth.js:22-55`). It creates a session at registration for non-athlete roles and starts welcome mail asynchronously.
- Managed athlete path checks club verification, coach ClubStaff identity/status/role/contract or admin permission; transaction creates user/profile/membership (`backend/controllers/managedAthletes.js`, `backend/utils/managedAthleteRegistration.js`).
- Parental pending state is enforced by middleware for most endpoints. Consent can be confirmed and withdrawn with time-limited hashed tokens; withdrawal revokes access, bumps tokenVersion, disconnects sockets, and removes managed athletes from active rosters.
- **Not established:** Independent proof of guardian identity/relationship, adult-to-minor contact restrictions after consent, age-specific contact consent, and end-to-end moderator response time.

## Direct messages / realtime

- HTTP messaging routes require auth; utility `conversationAcl.js` is the central membership helper. Socket `joinConversation` and `messageDeliveredAck` also check membership (`backend/server.js:694-760`).
- Typing only emits in a joined conversation room. Conversation membership alone does not demonstrate age-safety policy.
- Call signaling handlers do not consistently verify call participants; verified P1 at `backend/server.js:768-970`.
- Message attachment middleware uses local disk in some routes; inspect magic-byte test failure before relying on image validation. Existing test `backend/tests/upload-magic.test.js` currently fails real-PNG validation.

## Media / Cloudinary

- Uploads use Cloudinary `uploader.upload` with `resource_type`, folders and transformations but no per-asset private/authenticated access mode in `backend/middleware/uploadCloudinary.js:142-190` and profile upload paths.
- Resulting URLs are conventional secure Cloudinary URLs stored/delivered to clients. API filtering cannot revoke an already copied URL. Production Cloudinary account-level policy and existing asset delivery settings were not inspected.
- Before minors upload private data, choose either authenticated/signed delivery with short expiry or a documented and tested account-wide control; test direct URL access after consent withdrawal/deletion.

## Reporting, blocking, audit, deletion

- Report types include post/comment/profile/message/live/user; message report requires reporter to be a conversation member. Duplicate reports for same target by same user are limited to one per 24 hours (`backend/controllers/moderation.js:12-92`).
- Block is directional; `isEitherBlocked` checks either direction (`:225-236`). Audit all DM and call initiation, group invite and comment paths for consistent use.
- Admin report review tries to write an audit log but swallows failure (`:192-218`). High-risk moderation actions need durable audit failure handling/alerting.
- Account delete route exists. Deletion propagation to third-party Cloudinary objects, backups, messages, invoices and legally retained data needs separate verified evidence (`backend/controllers/accountDeletion.js`).

## Payment controls

- Stripe live card payments default off unless `PAYMENTS_ENABLED=true` and valid `sk_` key (`backend/config/payments.js:1-21`). Mobile EAS/app configuration explicitly keeps digital purchase flag false; mobile release preflight passed.
- Apple IAP supports receipt endpoint and signed JWS verification, checks configured bundle/product/transaction when claims are present (`backend/controllers/iap.js:100-158`). Google purchase path calls Android Publisher API (`utils/googlePlay.js:133-152`). Unverified IAP is blocked in production (`utils/iapPolicy.js:1-10`).
- Verified gap: `verifyAndFulfill` checks `IapPurchase` outside a transaction, performs Premium activation or JonCoin balance and ledger writes, then creates purchase record (`controllers/iap.js:211-319`). Concurrent duplicate consumable receipt requests can race fulfillment before unique insert conflict. JonCoin update + transaction + IAP record are not one atomic operation.
- Apple claim binding is permissive: signed JWS product/bundle/transaction checks use `!claim || matches` (`controllers/iap.js:108-124`); a valid signed payload missing expected identity claims is accepted by these comparisons. Require the correct Apple signed transaction type and mandatory claims for the active purchase path.
- Google product response validation checks purchase/payment state, but service-account/package/product/refund/acknowledgement operations were not run against Play.
- Do not enable payments for pilot until transaction claim + fulfillment is atomic/idempotent, provider claims are exact, refunds/revocations are designed, and sandbox cases pass.

## Minimum security test cases

Unauthenticated and wrong-role requests; cross-account athlete/profile/membership IDs; pending/revoked minor; valid and expired coach assignment; public GET side effect; forged call signaling; blocked adult/minor pair; direct Cloudinary URL after withdrawal; message attachment polyglot; concurrent duplicate IAP; Apple wrong bundle/product/transaction and missing claims; Google canceled/pending/expired/refunded; deletion propagation; and audit-log write failure.
