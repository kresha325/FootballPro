# Android / Google Play — Phase 2 notes

## Target configuration (verified in repo)

| Setting | Value | Source |
|---------|-------|--------|
| applicationId | `com.kresha325.xtalenti` | `android/app/build.gradle` |
| versionName | `1.0.0` | `android/app/build.gradle` |
| versionCode | `1` | `android/app/build.gradle` + `app.json` |
| minSdk | **24** | `android/gradle.properties` |
| compileSdk | **36** | `android/gradle.properties` |
| targetSdk | **36** | `android/gradle.properties` |
| buildTools | **36.0.0** | `android/gradle.properties` |
| New Architecture | **false** | `gradle.properties` |
| Hermes | **true** | `gradle.properties` |
| Edge-to-edge | **true** | `gradle.properties` / `app.json` |
| EAS production artifact | **`.aab` (app-bundle)** | `eas.json` |
| EAS autoIncrement | **true** (production) | `eas.json` |

## Permissions (production-oriented)

**Kept (required):** CAMERA, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS, INTERNET, ACCESS_NETWORK_STATE, READ_MEDIA_IMAGES, READ_MEDIA_VIDEO, BLUETOOTH, BLUETOOTH_CONNECT, VIBRATE, WAKE_LOCK

**Removed via `tools:node="remove"` / `blockedPermissions`:**
- `SYSTEM_ALERT_WINDOW` (dev overlay — not for Play production)
- `WRITE_EXTERNAL_STORAGE` / `READ_EXTERNAL_STORAGE` (legacy; replaced by media permissions for API 33+)
- `READ_MEDIA_AUDIO` (not required for current features)

Camera/mic hardware features marked `required=false` so Play does not exclude devices without camera.

## Local AAB build status

**NOT VERIFIED locally** in this environment:
- Android SDK present under `~/Library/Android/sdk`
- **Java / JRE not installed** (`java` unavailable via `/usr/libexec/java_home`)

Use EAS for production AAB:

```bash
cd mobile
eas build --platform android --profile production
```

## Manual Play Console checklist (still open)

- [ ] Upload AAB from EAS
- [ ] Data Safety form
- [ ] Content rating
- [ ] Privacy policy URL
- [ ] Account deletion URL / in-app flow (Phase 7)
- [ ] Photos/Videos permission declaration (if requesting READ_MEDIA_*)
- [ ] Ads declaration
- [ ] Billing / digital goods declaration (Phase 8)
