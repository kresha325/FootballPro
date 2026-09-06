# iOS App Store — Phase 3 notes

## Identity

| Field | Value |
|-------|-------|
| Bundle ID | `com.kresha325.xtalenti` |
| Display name | XTalenti |
| Marketing version | `1.0.0` |
| Build number | `1` |
| Deployment target | **15.1** |
| Apple Team (app.json) | `AM7TN896MK` |
| New Architecture | **OFF** |
| Encryption export | `ITSAppUsesNonExemptEncryption = false` |

## Permissions (truthful, in use)

| Key | Purpose |
|-----|---------|
| `NSCameraUsageDescription` | Live + video calls |
| `NSMicrophoneUsageDescription` | Live + calls |
| `NSPhotoLibraryUsageDescription` | Pick photos/videos for profile, posts, messages |

**Removed / not declared:**
- `NSFaceIDUsageDescription` — SecureStore does not use biometric `requireAuthentication`; `expo-secure-store` plugin set `faceIDPermission: false`
- `NSUserTrackingUsageDescription` / ATT — app does not track (`NSPrivacyTracking = false`)
- Push `aps-environment` entitlement — **Phase 4**: `development` in local entitlements; production builds via EAS/Apple

## Background modes

- `audio` — keep LiveKit / WebRTC call & live audio alive when app is backgrounded briefly
- `remote-notification` — Expo push (Phase 4)

## ATS

- `NSAllowsArbitraryLoads = false`
- `NSAllowsLocalNetworking = true` (dev client / local debugging only; production API is HTTPS)

## Privacy Manifest

`XTalenti/PrivacyInfo.xcprivacy`:
- Tracking: **false**
- Collected data types: empty at app level (update App Privacy in ASC to match real backend practices)
- Required Reason APIs: UserDefaults, File Timestamp, Disk Space, System Boot Time (SDK aggregates may add more at build time)

## Orientations

Portrait only (`supportsTablet: false`, `UIRequiresFullScreen: true`).

## Known follow-ups (not Phase 3 code)

1. **TestFlight** — `eas build --platform ios --profile production` then `eas submit`
2. **Push** — see `mobile/PUSH_NOTIFICATIONS.md` (Phase 4 done in repo; needs EAS rebuild + APNs)
3. **App Privacy / Privacy Policy URL** — App Store Connect + website
4. **Account deletion / UGC** — Phases 6–7 (App Review blockers)
5. After next `expo prebuild`, re-check Info.plist FaceID is not reintroduced; push entitlement retained

## Device build note (Phase 1/2)

Debug install succeeded with Development signing. Xcode 26 required `fmt` consteval workaround in `ios/Podfile` post_install.
