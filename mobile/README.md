Mobile app (Expo) for FootballPro

Quick start:

1. Install dependencies

```bash
cd mobile
npm install
```

2. Configure backend URL

Edit `app.json` -> `expo.extra.BACKEND_URL` or set it dynamically via EAS/Expo config.

3. Run in development

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
2. Set env on EAS and keep config dynamic via `app.config.js`.
