# Mobile Release QA Matrix

This checklist is for final Android preview/production validation before release.

## Pre-Flight

- Backend is reachable from device (`BACKEND_URL` correct).
- User can login with a valid test account.
- At least one test account exists for each role: athlete, scout, club.

## Core Flows

1. Auth

- Login works with valid credentials.
- Invalid credentials show clear error.
- Logout returns to login screen.

1. Feed & Content

- Feed loads posts.
- Like/unlike updates correctly.
- Comment add/read works.
- Create post with image works.
- Create post with video works.
- Gallery opens and shows new media.

1. Messaging & Notifications

- Conversations list loads.
- Open conversation and send message.
- Unread badges on `Chats` and `More` update after navigation.
- Notifications list opens from More and marks as read.

1. Marketplace & Wallet

- Marketplace products load.
- Buy action creates order (or expected pending response).
- Wallet balance loads.
- Buy JonCoin request works.
- Withdraw request works.
- Transfer request works.

1. Videos

- Videos list loads.
- Upload video works.
- Like video updates count.

1. Profile

- My profile loads.
- Edit profile saves.
- Browse profiles and open public profile.

1. Insights / Tournaments / Scouting

- Insights loads analytics + gamification + leaderboard.
- Tournaments list loads and join works.
- Scouting:

  - scout/club role can access recommendations.
  - other roles see access restriction.

## Device Quality

- Tab bar labels remain readable on small screens.
- Keyboard does not overlap tab bar unexpectedly.
- Loading states show skeletons, not blocking spinners, on key screens.
- No crash during app background/foreground transitions.

## Pass Criteria

- All critical flows above are PASS.
- No blocking crash or white screen.
- No repeated API failure loops in logs.
