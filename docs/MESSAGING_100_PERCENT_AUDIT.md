# Messaging production audit

Date: 2026-10-04  
Scope: existing FootballPro / Xtalenti messaging (web, backend, Socket.IO, mobile). No rewrite. Admin, tournaments, marketplace, profiles, feed, AI, payments, and analytics were not changed except where messaging already called them (moderation reports, block checks, push helper, call start).

Status words:

- **IMPLEMENTED** — present in the current code
- **VERIFIED** — checked by an automated test or by a successful build/parse in this session
- **NOT VERIFIED** — implemented or pre-existing, but not executed against a running API, database, or browser in this session
- **BLOCKED** — needs a real device, live database migration, or external service

This is not a claim that messaging is live-production certified. The migration `backend/migrations/20261004120000-messaging-production.js` was written and was **not** applied to a database here.

## What was already in place

- Conversations, members (`admin` / `member`), messages, replies, edit, soft delete, file upload, unread via `lastReadAt`, Socket.IO rooms, typing, presence, LiveKit/WebRTC calls, mobile conversation screen, email on new message, moderation `Block` and `Report` models.

## Gaps found and what changed

| Problem | Fix |
| --- | --- |
| 1:1 lookup could match a group that contains both users | Direct lookup SQL now requires `isGroup = false`, with a transaction advisory lock before create |
| `markAsRead` did not require membership and could emit a fake read | Membership check, then `isRead` update and `conversationRead` / `messageRead` |
| Socket `sendMessage` rebroadcast client payloads | Handler ignores client payloads. HTTP API is the source of truth |
| Typing events were not room-checked and had no conversation id | Emitted only if the socket joined that conversation; payload includes `conversationId`; clients drop stale typing after 4s |
| Upload filter accepted MIME **or** extension | Both must match, then magic-byte check. Executables rejected. Bad files deleted |
| Empty / huge text accepted | Trim, reject whitespace-only text unless a file is attached, max 4000 chars |
| Deleted replies still exposed content | Reply payload redacted to “unavailable” |
| Reactions missing | `MessageReactions` unique `(messageId, userId, emoji)`, toggle API, socket `messageReactionUpdated` |
| No group owner / remove / promote / rename / avatar | Owner id, admin-only management, member invite kept |
| Forward re-uploaded media and could fail | `POST /messages/:id/forward` copies the stored file and sets `forwarded` |
| Message search loaded only the open page on the client | `GET .../messages/search` uses database `ILIKE`, excludes deleted |
| Unread counts were N+1 | One grouped SQL count for the list and one count for the badge |
| New messages did not push | Push + email, skipped when the recipient socket is inside that conversation room |
| Delivery was only “has an id” | `deliveredAt` when a recipient is online or acks; read still requires `lastReadAt` |
| Non-members could report any message id | Message reports require conversation membership |
| Calls to a blocked user were not rejected on start | Block check on HTTP start/create and on `call:offer` |

## Checklist

| Feature | Web | API | DB | Socket | Mobile | Errors | Auth | Test | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1:1 create / reuse / open | yes | yes | yes | join room | yes | yes | member + block | SQL shape unit test | IMPLEMENTED, NOT VERIFIED live |
| Ordering by newest message | yes, list moves on `newMessage` | `lastMessageAt` | column exists | `newMessage` | list refresh via socket on home | yes | member | not a DB test | IMPLEMENTED, NOT VERIFIED live |
| Group create, invite, leave | yes | yes | yes | `conversationUpdated` | yes | yes | member | permission unit tests | IMPLEMENTED, NOT VERIFIED live |
| Rename, avatar, remove, promote, demote, transfer | yes | yes | `ownerId` migration | `conversationUpdated` | rename, long-press actions | yes | admin/owner on server | permission unit tests | IMPLEMENTED, NOT VERIFIED live |
| Text, multiline, Albanian, emoji, length | yes, text nodes | yes | `TEXT` | yes | yes | yes | member | `messageContent` tests | VERIFIED |
| Links | `http(s)` anchors only, no HTML | stored as text | text | n/a | plain `Text` | n/a | n/a | link test | VERIFIED |
| Reactions ❤️👍😂🔥👏😮😢 | yes | toggle | unique index in migration | `messageReactionUpdated` | yes | yes | member, no duplicate row | summary/toggle tests | IMPLEMENTED, NOT VERIFIED live |
| Reply + missing original | preview, click, highlight | same-conversation parent | `replyToId` | with message | preview, scroll | yes | member | redact test | IMPLEMENTED, NOT VERIFIED live |
| Forward to DM or group | yes | copy, `forwarded: true` | `forwarded` migration | `newMessage` | yes | yes | member of both; block on DM | not a DB test | IMPLEMENTED, NOT VERIFIED live |
| Edit | sender UI | sender + member, not deleted, text only | `edited` | `messageUpdated` | yes | yes | server | not a DB test | IMPLEMENTED, NOT VERIFIED live |
| Delete for everyone | tombstone | sender + member, soft delete | `deleted` | `messageDeleted` | yes | yes | server | redact test | IMPLEMENTED, NOT VERIFIED live |
| SENDING / SENT / DELIVERED / READ | composer + ticks | `deliveredAt`, `lastReadAt`, `isRead` | migration for `deliveredAt` | delivered + read events | ticks | failed send kept | read requires membership | status unit test | IMPLEMENTED, NOT VERIFIED live |
| Typing | debounced | n/a | n/a | room-scoped + timeout | yes | n/a | joined room only | not a socket test | IMPLEMENTED, NOT VERIFIED live |
| Online / last seen | existing presence | `/users/:id/online` | `lastSeenAt` | `presence:update` | yes | yes | JWT socket | not retested | NOT VERIFIED |
| Images, video, PDF, documents | picker | 10MB, MIME and signature | file path on message | with message | gallery images/videos | failure banner | member | JPEG/PDF signature test | IMPLEMENTED, NOT VERIFIED live |
| Media error state | broken image/video label | n/a | n/a | n/a | broken image label | yes | n/a | not a UI test | IMPLEMENTED, NOT VERIFIED live |
| Conversation search | client filter of loaded list | list endpoint | n/a | n/a | home search | yes | member | not a test | NOT VERIFIED |
| Message search | server search | `ILIKE` content and file name, deleted excluded | uses message indexes from migration | n/a | search field | yes | member | LIKE escape test | IMPLEMENTED, NOT VERIFIED live |
| Older messages without jump | scroll delta + near-top load | page/limit capped at 100 | `createdAt` index in migration | n/a | `maintainVisibleContentPosition` + near-top load | yes | member | not a UI test | IMPLEMENTED, NOT VERIFIED live |
| Socket events | listeners cleaned up | emitted from API | n/a | listed below | listeners cleaned up | yes | join requires membership | not a socket test | IMPLEMENTED, NOT VERIFIED live |
| Reconnect sync | rejoin + merge page 1 | messages endpoint | n/a | `reconnect` | same | error text if sync fails | membership | not disconnected live | NOT VERIFIED |
| Offline / send failure | input kept, error banner | 4xx messages | n/a | disconnect handled by client | pending bubble + retry text | yes | auth 401 from existing client | not a network test | IMPLEMENTED, NOT VERIFIED live |
| Unread total and per chat | badge event + local count | single SQL | `lastReadAt` | `newMessage` | existing badge hook | yes | auth | not a DB test | IMPLEMENTED, NOT VERIFIED live |
| Email notification | n/a | existing template | n/a | n/a | n/a | logged on failure | recipient member | not sent | NOT VERIFIED |
| Push + deep link | web push via existing helper | preview, `conversationId`, skipped if viewing | tokens on user | n/a | existing open handler | logged on failure | recipient | not a device | BLOCKED — REQUIRES REAL DEVICE / EXTERNAL SERVICE |
| Block | DM header | DM create, DM send, group invite skip, calls | existing `Blocks` | `call:failed` | header action | yes | server | not a DB test | IMPLEMENTED, NOT VERIFIED live |
| Report | message reasons | existing reports + membership | existing `Reports` | n/a | existing sheet | yes | member, not own message | not a DB test | IMPLEMENTED, NOT VERIFIED live |
| Audio / video calls | existing LiveKit / WebRTC | block on start | existing call tables | existing call events | existing screens | existing | participant checks already present | existing call ACL unit test still passes | BLOCKED — REQUIRES REAL DEVICE / EXTERNAL SERVICE |
| IDOR on conversations | n/a | member checks on read, messages, edit, delete, reactions, forward | n/a | join denied if not member | n/a | 403 | server | ACL unit test | VERIFIED for helper; HTTP three-user run NOT VERIFIED |
| Rate limit | 429 copy | 40 sends / minute / user, plus global limiter | n/a | n/a | shows API message | yes | after auth | not load-tested | IMPLEMENTED, NOT VERIFIED live |
| Indexes | n/a | n/a | migration adds conversation/time, sender, member, reaction indexes | n/a | n/a | n/a | n/a | migration not applied | NOT VERIFIED |
| Large thread performance | page size 50, search on server | capped pages, unread query collapsed | indexes not applied | n/a | FlatList | n/a | n/a | no 1000-message run | NOT VERIFIED |
| Web production build | `npm run build` passed | n/a | n/a | n/a | n/a | n/a | n/a | build | VERIFIED |
| iOS / Android install | n/a | n/a | n/a | n/a | code parsed with Babel | n/a | n/a | no device | BLOCKED — REQUIRES REAL DEVICE / EXTERNAL SERVICE |
| Multi-user script (A/B/C/D) | n/a | n/a | n/a | n/a | n/a | n/a | n/a | not run | NOT VERIFIED |

Socket events now used by messaging: `newMessage`, `messageUpdated`, `messageDeleted`, `messageReactionUpdated`, `messageDelivered`, `messageRead`, `conversationRead`, `userTyping`, `userStoppedTyping`, `presence:update` (`online` / `offline` payload), `conversationUpdated`. Client `sendMessage` is ignored.

## Security notes checked in code

- Unauthenticated HTTP routes use the existing `auth` middleware.
- Message, reaction, forward, search, read, and group management handlers call membership or role checks on the server.
- A normal member is rejected by `authorizeGroupAction` for remove, promote, demote, rename, avatar, and transfer. Covered by unit tests.
- User content is rendered as text. Links are only `http` / `https`.
- API errors no longer return raw exception text from the messaging controller.
- Debug logs of `req.user` and message ids were removed from the messaging controller. Server error logs remain, without message bodies.

## Tests and build run in this session

- `backend`: `node --test tests/*.test.js` — 42 passed, 0 failed
- `frontend`: `npx vitest run` on message presentation + existing live-stream test — 6 passed
- `frontend`: `npx eslint` on `Messaging.jsx`, `ForwardButton.jsx`, `messagePresentation.js` — 0 errors
- `frontend`: `npm run build` — passed
- `mobile`: Babel parse of conversation, messaging home, forward modal, actions sheet, API client — passed
- Not run: database migration, HTTP calls with real users, browser click-through, iOS, Android, LiveKit, push delivery, 1,000-message timing

## Required before calling this production-live

1. Apply `20261004120000-messaging-production.js` on the target Postgres database.
2. Run a real A/B/C/D session (send, edit, react, image, delete, group admin denial, block, reconnect).
3. Place an audio and a video call on web and on a physical phone, including permission denial and a dropped network.
4. Confirm a push while the app is backgrounded and killed, and that tapping it opens the conversation.
5. Load a conversation with 1,000 messages and confirm scroll and search stay responsive.
