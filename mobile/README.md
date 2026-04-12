# FootballPro Mobile (Expo)

Current status:

- Mobile feature parity has been expanded significantly to cover auth, feed, comments/likes, profile flows, messaging, notifications, marketplace, wallet, videos, insights, tournaments, and scouting.
- Navigation is optimized with a smaller core tab bar and a `More` hub for secondary modules.
- Unread badges are enabled for `Chats` and `More` (notifications), including refresh on focus/state changes.
- Network resilience includes GET retry/backoff on transient failures.

Quick start:

1. Install dependencies

```bash
cd mobile
npm install
```

1. Configure backend URL

Edit `app.json` -> `expo.extra.BACKEND_URL` or set it dynamically via EAS/Expo config.

1. Run in development

```bash
npm start
# then open with Expo Go on your phone or emulator
```

Notes:

- This is a minimal scaffold. You should configure credentials, environment, and push updates via Expo/EAS if you want OTA updates.
- The app uses Socket.IO client and will attempt to connect to `BACKEND_URL` on login.

Publish / build commands (examples):

```bash
# publish OTA (Expo managed)
expo publish --release-channel production

# or using the npm script
cd mobile
npm run publish

# EAS build example (requires eas cli + account)
eas build -p android --profile production
npm run eas-build
```

QA commands:

```bash
# quick smoke checklist output
npm run smoke:checklist
```

Release checklist docs:

- `RELEASE_QA.md` - release matrix for Android preview/production validation
- `scripts/smoke-checklist.js` - terminal checklist helper

EAS setup prepared in this folder:

- `eas.json` is added with `development`, `preview`, and `production` profiles.
- `app.config.js` is added so `BACKEND_URL` can be injected from EAS env at build time.

Recommended deploy flow (Android):

```bash
cd mobile

# 1) login once
eas login

# 2) initialize project on Expo (first time only)
eas init

# 3) build test APK (internal testing)
eas build -p android --profile preview

# 4) build production AAB (Play Store)
eas build -p android --profile production
```

If backend URL changes:

1. Update `BACKEND_URL` values in `eas.json`, or
1. Set env on EAS and keep config dynamic via `app.config.js`.

Recommended release flow:

1. `npm install`
2. `npm run smoke:checklist`
3. Run manual test pass from `RELEASE_QA.md`
4. Build preview: `eas build -p android --profile preview`
5. Build production: `eas build -p android --profile production`
