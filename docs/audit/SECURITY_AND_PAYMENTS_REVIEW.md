# Security and Payments Review

## Authentication / authorization

- `backend/middleware/auth.js` validates a bearer JWT, reloads the User, checks token version and blocked/deleted account state, and applies parental authorization except explicit allowlisted routes. This is a positive central control.
- Admin permission tiers use `backend/services/admin/rbac.js`; missing admin tier is treated compatibly as super-admin according to tests. Each handler still needs a server-side permission check.
- Verified P1/P2 object authorization and privacy findings are listed in `XTALENTI_V1_FULL_AUDIT.md`.

## Latest code verification — 2026-10-30

- Legacy athlete profile responses now apply `applyProfilePrivacy`, avoid exact DOB/account fields, and filter minors without active verified guardian consent. Regression tests and a local PostgreSQL route test passed on `fix/xtalenti-v1-p1-security`.
- Direct-call Socket.IO signaling now requires an active server-owned `VideoCall`, verifies actor and recipient direction, checks mutual blocks fail-closed, applies event limits, and never creates a call/conversation from `call:offer`. Web and mobile send `callId`; actual WebRTC/LiveKit device lifecycle remains unverified.
- `GET /api/club-members/club/:clubId` no longer writes; `GET /api/club-members/athlete/:athleteId` returns only approved affiliations to unrelated authenticated viewers, and scopes pending/rejected rows to the athlete, an explicitly linked guardian, admin, verified club, or active authorized coach. Route integration passed against a disposable PostgreSQL DB.
- These fixes are on a review branch, not merged to `main` or deployed. Guardian consent currently proves access to the registered email and an attestation, not legal identity/relationship.

## Child accounts and guardian authorization

- Public `/api/auth/register` rejects explicit athlete role and does not default a missing role (`backend/controllers/auth.js:22-55`). It creates a session at registration for non-athlete roles and starts welcome mail asynchronously.
- Managed athlete path checks club verification, coach ClubStaff identity/status/role/contract or admin permission; transaction creates user/profile/membership (`backend/controllers/managedAthletes.js`, `backend/utils/managedAthleteRegistration.js`).
- Parental pending state is enforced by middleware for most endpoints. Consent can be confirmed and withdrawn with time-limited hashed tokens; withdrawal revokes access, bumps tokenVersion, disconnects sockets, and removes managed athletes from active rosters.
- **Not established:** Independent proof of guardian identity/relationship, adult-to-minor contact restrictions after consent, age-specific contact consent, and end-to-end moderator response time.

## Direct messages / realtime

- HTTP messaging routes require auth; utility `conversationAcl.js` is the central membership helper. Socket `joinConversation` and `messageDeliveredAck` also check membership (`backend/server.js:694-760`).
- Typing only emits in a joined conversation room. Conversation membership alone does not demonstrate age-safety policy.
- Direct call signaling participant validation is centralized in `backend/utils/callSignaling.js`. Adult/minor contact policy and native lifecycle testing remain open.
- Message attachment middleware uses local disk in some routes. `backend/utils/uploadMagic.js` normalizes the `file-type` v16 and v17+ APIs; the real-PNG validation test passes on the installed dependency.

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
- Apple IAP uses receipt endpoint and signed JWS verification; the current code requires exact bundle/product/transaction claims, and active, non-revoked subscriptions (`backend/controllers/iap.js`). Google purchase path calls Android Publisher API (`utils/googlePlay.js:133-152`). Unverified IAP is blocked in production (`utils/iapPolicy.js:1-10`).
- **Fixed in current working tree:** IAP transaction claim is inserted before fulfillment inside the same Sequelize transaction. Premium, Payment, invoice, JonCoin balance/ledger, and completed purchase record use that transaction; the unique `transactionId` index serializes duplicate claims. Duplicate responses are restricted to the same completed user/product/platform and omit purchase tokens. Five focused tests cover transaction propagation, duplicate ownership, token redaction and a simulated unique-conflict race. Production application of the unique index and a two-session PostgreSQL race are not verified yet.
- **Fixed in current working tree:** legacy Apple receipts must contain the exact app bundle, product and transaction in the verified receipt entries. StoreKit JWS must contain matching product, bundle and transaction claims; subscriptions must be unexpired and not revoked. Seven focused receipt/JWS tests pass, including generated signed-chain fixtures. No live Apple sandbox request was made.
- **Fixed in the current review branch:** verified Google Play purchases now key the unique claim and fulfillment idempotency on the provider-returned `orderId`, namespaced as `google:<orderId>`, and reject responses without a valid order identity or with a product mismatch. Client `transactionId` is retained only for the explicitly unverified development path. Regression tests cover provider order binding and missing/mismatched identity; live Play sandbox/token-reuse behavior remains unverified.
- Google product response validation checks purchase/payment state, but service-account/package/product/refund/acknowledgement operations were not run against Play.
- Do not enable payments for pilot until the atomic claim passes a disposable-PostgreSQL concurrency test, refunds/revocations are designed, and Apple/Google sandbox cases pass.

## Minimum security test cases

Unauthenticated and wrong-role requests; cross-account athlete/profile/membership IDs; pending/revoked minor; valid and expired coach assignment; public GET side effect; forged call signaling; blocked adult/minor pair; direct Cloudinary URL after withdrawal; message attachment polyglot; concurrent duplicate IAP; Apple wrong bundle/product/transaction and missing claims; Google canceled/pending/expired/refunded; deletion propagation; and audit-log write failure.
