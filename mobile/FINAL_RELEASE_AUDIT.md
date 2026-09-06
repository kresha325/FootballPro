# XTALENTI Production Release Audit

## 🟢 READY (repo / config)

- Expo SDK 53 / RN 0.79 / React 19 upgrade path
- Android API 36 target + permission hygiene
- iOS Info.plist / privacy / ATS / portrait / audio background
- Push client wiring (`expo-notifications`) + backend token clear
- LiveKit ACL tightening + call/live cleanup hooks
- Report / Block API + mobile UI (profile, posts)
- Account deletion (soft anonymize) + ban fields + login/auth enforcement
- Legal pages: `/community-guidelines`, `/privacy`, `/terms`
- API client timeout + GET retry + 401 → logout
- Versioning: app `1.0.0`, Android `versionCode` 1, iOS `buildNumber` 1
- Docs: RELEASE_AUDIT, PUSH, LIVEKIT, PAYMENTS, PRODUCTION_CONFIG, STORE checklist

## 🟡 WARNING

- Premium/JonCoin IAP not implemented — mobile digital buys gated (`ALLOW_MOBILE_DIGITAL_PURCHASES=false`)
- Physical device LiveKit matrix NOT VERIFIED
- Push requires new native build + APNs/FCM credentials
- Migration `20260906190000-ugc-moderation-account-deletion.js` must run on production
- Community guidelines pages are minimal starter copy — legal review recommended
- Camera flip on native Go Live still missing vs web

## 🔴 BLOCKER (store submission)

1. **EAS production builds + TestFlight / Play internal testing** — not run in this environment for final sign-off
2. **Crash-free critical path testing on physical iOS + Android** — NOT VERIFIED here
3. **IAP** still needed before enabling paid digital goods in the store binary (currently gated off)
## CHANGED FILES (this multi-phase pass — summary)

Backend: moderation + accountDeletion + migration + User fields + auth/ban + livekitAcl + videoCalls ACL + messaging block gate + notifications push (prior)  
Mobile: push (prior), LiveKit harden, ReportSheet, Settings delete, Profile/Feed report/block, API reliability, docs  
Frontend: LegalPage + routes

## DATABASE MIGRATIONS

- `backend/migrations/20260906190000-ugc-moderation-account-deletion.js`  
  Adds `Users.bannedAt|banReason|deletedAt|deletionRequestedAt`, tables `Reports`, `Blocks`

## DEPENDENCY UPDATES

- Phase 1 (earlier): Expo 53 matrix  
- Phase 4: `expo-notifications`, `expo-device`

## BUILD STATUS

Android: NOT VERIFIED (no local Java AAB in this session)  
iOS: NOT VERIFIED for this multi-phase pass (prior Debug install existed)

## TEST STATUS

- Syntax checks on touched JS modules: run locally  
- Full Phase 15 device matrix: NOT VERIFIED  
- Backend `npm run test:phase1` / migrate: run on deploy host

## STORE REQUIREMENTS

Apple: **NOT READY** (IAP + TestFlight + device QA)  
Google Play: **NOT READY** (Billing + AAB + device QA)

## REMAINING MANUAL ACTIONS

1. Run migration on production Postgres  
2. Redeploy backend  
3. `eas build` iOS + Android production; configure APNs/FCM  
4. Decide Premium/JonCoin IAP strategy and implement before store submit  
5. Fill ASC / Play Console privacy & data safety  
6. Physical device QA checklist (auth, feed, live, call, report, delete account)
