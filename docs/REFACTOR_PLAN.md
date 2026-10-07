# Refactor plan

These files stay as they are in this pass. The split below is a later change, one file at a time, without changing API responses or screen behavior.

## 1. `backend/controllers/profiles.js` (2251 lines)

Handlers already group themselves:

- Profile read and write: `createProfile`, `getProfile`, `updateProfile`, `getAllProfiles`, `getPublicProfileCv`
- Follow graph: `followUser`, `unfollowUser`, `getFollowers`, `getFollowing`, `checkFollowStatus`
- Push tokens: `registerPushToken`, `clearPushToken`
- Tournament summary: `getUserTournamentSummary`
- Landing: `getLandingShowcase`

Move the helpers (`resolveCareerHistoryForProfile`, `countFollowStats`, `enrichClubDisplayFields`, `attachJoinedLigas`, `attachStadium`) into `backend/utils/` next to the profile helpers that already live there. Leave the route module requiring the same exported handler names.

## 2. `mobile/src/screens/ConversationScreen.js` (1975 lines)

`MessageBubble` (from about line 139) is already a separate component. Move it, `MessageStatusTicks`, and the message URL/time helpers into `mobile/src/screens/conversation/MessageBubble.js`. Leave the screen for the socket connection, the send path, and the message list.

## 3. `frontend/src/components/Messaging.jsx` (1922 lines)

`ChatMedia`, `Linkify`, and `MediaModal` are already separate functions at the top. Move those into `frontend/src/components/messaging/`. Split the `Messaging` function into the conversation list, the open thread, and the composer, and keep `Messaging.jsx` as the parent that owns the selected conversation.

## 4. `frontend/src/components/TournamentSimple.jsx` (1910 lines)

`MatchBroadcastModal` ends near line 338 and the page component starts there. Move the modal into its own file. Split the page into registration, the fixture list, and the standings table. Keep `TournamentSimple` as the route component.

## 5. `frontend/src/components/AdminDashboard.jsx` (1718 lines)

The tabs are already separate blocks: `dashboard`, `users`, `content`, `joncoin`, `invoices`, `reports`, `stadiums`, `media`, `tournaments`. Move each `activeTab === '...'` block into `frontend/src/components/admin/` and leave `AdminDashboard.jsx` as the tab shell plus `StatCard` and `Pagination`.
