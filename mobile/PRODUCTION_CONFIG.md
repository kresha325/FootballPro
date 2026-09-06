# Production configuration — Phase 12

## Mobile production sources

| Key | Source | Production value |
|-----|--------|------------------|
| API | `app.json` `extra.BACKEND_URL` / EAS env | `https://footballpro.onrender.com` |
| Web embeds | `extra.WEB_APP_URL` | `https://xtalenti.com` |
| EAS project | `extra.eas.projectId` | `3352bbbe-2f86-4665-9a67-e0499d1051bc` |

## localhost / LAN scan (mobile/src + app.json + eas.json)

**Result (2026-09-06):** no `localhost` / `127.0.0.1` / `192.168.*` hits in production mobile config sources.

Dev-client LAN Metro (`http://192.168.x.x:8081`) is runtime-only and not bundled as API base.

## Profiles

| Profile | Use |
|---------|-----|
| `development` | Dev client, internal |
| `preview` | Internal APK |
| `production` | Store AAB / iOS release |

## Manual

Confirm Render env has production LiveKit, Cloudinary, Stripe, JWT_SECRET, VAPID, Expo push credentials.
