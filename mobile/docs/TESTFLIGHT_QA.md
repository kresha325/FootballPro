# XTalenti — TestFlight QA checklist

Use this on a **physical iPhone** with a production or internal TestFlight build.
Mark each item **PASS / FAIL / N/A** and note the build number (`CFBundleVersion`).

**Build under test:** ____________  
**Tester:** ____________  
**Date:** ____________

---

## Authentication

| # | Case | Result |
|---|------|--------|
| A1 | Register new account | |
| A2 | Login with valid credentials | |
| A3 | Login with invalid credentials (error shown) | |
| A4 | Logout clears session and returns to landing/login | |
| A5 | Forgot password → email / reset flow | |
| A6 | Kill app and reopen — session persists | |
| A7 | Expired / invalid token → forced logout, no crash | |

## Profile

| # | Case | Result |
|---|------|--------|
| P1 | View own profile | |
| P2 | Edit profile fields and save | |
| P3 | Change avatar (photo library) | |
| P4 | Upload gallery / media | |
| P5 | Browse / public profile of another user | |
| P6 | Parent verification entry (if underage athlete) | |

## Social / Feed

| # | Case | Result |
|---|------|--------|
| F1 | Feed loads | |
| F2 | Create post (text / image / video) | |
| F3 | Like / unlike | |
| F4 | Comment | |
| F5 | Notifications list + mark read | |
| F6 | Follow / connect actions | |
| F7 | Report / block user or post | |

## Messaging

| # | Case | Result |
|---|------|--------|
| M1 | Conversations list loads | |
| M2 | Open conversation | |
| M3 | Send text message | |
| M4 | Send image attachment | |
| M5 | Receive message (second device / account) | |
| M6 | Push notification for new message | |
| M7 | Tap push → opens correct conversation | |
| M8 | Block / report from conversation or profile | |

## Video calls (LiveKit)

| # | Case | Result |
|---|------|--------|
| V1 | Start outgoing call | |
| V2 | Accept incoming call | |
| V3 | Reject incoming call | |
| V4 | Camera on | |
| V5 | Microphone on | |
| V6 | Mute / unmute | |
| V7 | Camera off / on | |
| V8 | Hang up ends room for both | |
| V9 | Brief network drop → reconnect or graceful fail | |
| V10 | Denied camera/mic → clear error, no crash | |

## Live

| # | Case | Result |
|---|------|--------|
| L1 | Go Live starts broadcast | |
| L2 | Camera + microphone work | |
| L3 | Viewer can join | |
| L4 | Viewer count updates | |
| L5 | End Live cleans up | |

## Marketplace

| # | Case | Result |
|---|------|--------|
| K1 | Browse products | |
| K2 | Search | |
| K3 | Product details | |
| K4 | Create / edit product (seller) | |
| K5 | Purchase / order flow (JonCoin if applicable) | |

## JonCoin / Wallet

| # | Case | Result |
|---|------|--------|
| J1 | Balance loads | |
| J2 | Purchase pack via IAP (sandbox) | |
| J3 | Transaction appears in history | |
| J4 | Cancelled purchase — no credit | |
| J5 | Duplicate / replay of same tx — no double credit | |
| J6 | Transfer / withdraw (if enabled) | |

## Premium

| # | Case | Result |
|---|------|--------|
| R1 | Monthly IAP purchase (sandbox) | |
| R2 | Yearly IAP purchase (sandbox) | |
| R3 | Premium status on profile after verify | |
| R4 | Restore purchases restores active sub | |
| R5 | Invalid / failed purchase — no Premium grant | |
| R6 | Web Stripe Premium does not break mobile IAP state | |

## Account / legal

| # | Case | Result |
|---|------|--------|
| S1 | Settings opens | |
| S2 | Privacy Policy opens (`https://xtalenti.com/privacy`) | |
| S3 | Terms opens (`https://xtalenti.com/terms`) | |
| S4 | Community guidelines opens | |
| S5 | Delete account (password + confirm) → anonymize + logout | |
| S6 | Deleted account cannot log in | |
| S7 | Logout | |

## Deep links / scheme

| # | Case | Result |
|---|------|--------|
| D1 | `xtalenti://` opens app | |
| D2 | Legacy `footballpro://` still opens app | |
| D3 | Password reset universal / deep link | |

## Push (production APNs)

| # | Case | Result |
|---|------|--------|
| N1 | Permission prompt on physical device | |
| N2 | Token stored (`Users.pushTokenMobile`) | |
| N3 | Toggle off in Settings clears token | |
| N4 | Logout clears push token | |

---

## Sign-off

Critical path PASS (auth, feed, messaging, call/live, IAP sandbox, delete account): **YES / NO**

Blockers found:

1. ________________________________________________
2. ________________________________________________
