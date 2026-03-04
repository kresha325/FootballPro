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
