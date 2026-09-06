# Push notifications — Phase 4

## Stack

- Client: `expo-notifications` + `expo-device` (dev client / EAS, not Expo Go)
- Transport: Expo Push → APNs / FCM
- Backend: `POST /api/profiles/me/push-token` stores `Users.pushTokenMobile`
- Send: `sendNotification` / `createNotification` in `backend/controllers/notifications.js`

## Mobile wiring

| Piece | Path |
|-------|------|
| Register / preference / clear | `src/notifications/push.js` |
| Tap / cold-start deep link | `src/notifications/handlePushOpen.js` |
| Lifecycle | `src/components/PushNotificationManager.js` (mounted in `App.js`) |
| Settings toggle | `SettingsScreen` |
| Logout clears token | `AuthContext.logout` |

## Config

- `app.json`: `expo-notifications` plugin, `UIBackgroundModes: remote-notification`, `extra.eas.projectId`
- iOS local: `aps-environment` = `development` in entitlements (EAS production profile sets production via Apple)
- Android 13+: `POST_NOTIFICATIONS` comes from the notifications config plugin

## Rebuild required

Native push needs a **new** iOS/Android binary after this phase:

```bash
cd mobile
npx expo prebuild --clean   # optional if regenerating native
eas build --platform ios --profile development   # or production
eas build --platform android --profile development
```

Credentials: Expo project `3352bbbe-2f86-4665-9a67-e0499d1051bc` must have APNs key / FCM in EAS credentials.

## Test checklist

1. Login on a **physical** device → allow notifications → token stored (check DB `pushTokenMobile`)
2. Like / comment / follow from another account → push arrives
3. Incoming call push → opens call / messaging flow
4. Tap notification from killed state → deep link works
5. Settings toggle off → token cleared; toggle on → re-registers
6. Logout → token cleared server-side

## Privacy

Push bodies for `type: message` are generic (`Ke një mesazh të ri`); full text stays in-app only.
