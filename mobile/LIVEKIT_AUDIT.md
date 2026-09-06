# LiveKit / WebRTC — Phase 5 audit

**Date:** 2026-09-06  
**Scope:** mobile native LiveKit + backend token ACL (no architecture rewrite)

## Hardening applied (repo)

| Fix | Status |
|-----|--------|
| Call tokens only when `ringing`/`connected` | DONE (`livekitAcl.js`) |
| Stream tokens require `isLive` (non-owner) + premium mirror | DONE |
| `endCall` / `updateCallStatus` participant-only | DONE |
| Go Live `beforeRemove` → `endStreamRequest` | DONE |
| Outgoing call `beforeRemove` hang-up | DONE |
| Incoming modal clears on `call:end` / `call:ended` | DONE |
| Cam/mic permissions before call connect | DONE |
| Broadcaster/viewer disconnect handling | DONE |

## Still NOT VERIFIED on devices

- Physical iPhone reconnect Wi‑Fi ↔ cellular
- Physical Android same
- Long background while live
- Camera flip UX (parity with web) — deferred

## Known residual risks

- Viewer count join/heartbeat race
- Group rooms still allow publish for members
- Emulator-only testing is insufficient for store sign-off
