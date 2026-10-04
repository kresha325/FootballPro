const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateMessageText, escapeLike, MAX_MESSAGE_LENGTH } = require('../utils/messageContent');
const { signatureOk } = require('../utils/messageUpload');
const { DIRECT_PAIR_SQL, pairKey } = require('../utils/directConversation');
const {
  normalizeReactionEmoji,
  reactionToggleDecision,
  summarizeReactions,
  redactReply,
} = require('../utils/messageReactions');
const { authorizeGroupAction } = require('../utils/groupPermissions');
const { userIsViewingConversation } = require('../utils/conversationPresence');

describe('message text validation', () => {
  it('rejects empty and whitespace-only text', () => {
    assert.equal(validateMessageText('   ').ok, false);
    assert.equal(validateMessageText('').ok, false);
  });

  it('allows empty text when a file is attached', () => {
    assert.equal(validateMessageText('   ', { allowEmpty: true }).ok, true);
  });

  it('keeps Albanian characters, emoji and multiline text', () => {
    const text = 'Çfarë bën në Tiranë?\nShumë mirë 😀';
    const result = validateMessageText(text);
    assert.equal(result.ok, true);
    assert.equal(result.text, text);
  });

  it('rejects oversized messages', () => {
    const result = validateMessageText('a'.repeat(MAX_MESSAGE_LENGTH + 1));
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
  });

  it('strips null bytes', () => {
    const result = validateMessageText('a\u0000b');
    assert.equal(result.text, 'ab');
  });
});

describe('search escaping', () => {
  it('escapes LIKE wildcards', () => {
    assert.equal(escapeLike('100%_off'), '100\\%\\_off');
  });
});

describe('upload signatures', () => {
  it('accepts a JPEG header and rejects an executable header renamed as jpeg', () => {
    assert.equal(signatureOk('.jpg', Buffer.from([0xff, 0xd8, 0xff, 0x00])), true);
    assert.equal(signatureOk('.jpg', Buffer.from([0x4d, 0x5a, 0x90, 0x00])), false);
    assert.equal(signatureOk('.pdf', Buffer.from('%PDF-1.7')), true);
  });
});

describe('direct conversation lookup', () => {
  it('excludes group conversations', () => {
    assert.match(DIRECT_PAIR_SQL, /isGroup/);
    assert.equal(pairKey(9, 2), '2:9');
  });
});

describe('reactions', () => {
  it('allows the supported set and toggles duplicates off', () => {
    assert.equal(normalizeReactionEmoji('❤️'), '❤️');
    assert.equal(normalizeReactionEmoji('💩'), null);
    assert.equal(reactionToggleDecision(null), 'add');
    assert.equal(reactionToggleDecision({ id: 1 }), 'remove');
  });

  it('counts multiple users without duplicating the current user flag', () => {
    const summary = summarizeReactions(
      [
        { emoji: '❤️', userId: 1 },
        { emoji: '❤️', userId: 2 },
        { emoji: '👍', userId: 1 },
      ],
      1
    );
    assert.deepEqual(summary, [
      { emoji: '❤️', count: 2, mine: true },
      { emoji: '👍', count: 1, mine: true },
    ]);
  });

  it('redacts a deleted reply', () => {
    const reply = redactReply({ id: 4, deleted: true, content: 'secret', fileUrl: '/x', sender: { id: 2 } });
    assert.equal(reply.unavailable, true);
    assert.equal(reply.content, null);
    assert.equal(reply.fileUrl, null);
  });
});

describe('group permissions', () => {
  it('lets any member invite and blocks a member from removing someone', () => {
    assert.equal(authorizeGroupAction({
      action: 'invite', actorId: 3, actorRole: 'member', isGroup: true,
    }).ok, true);
    const remove = authorizeGroupAction({
      action: 'remove', actorId: 3, actorRole: 'member', targetId: 4, targetRole: 'member', isGroup: true, ownerId: 1,
    });
    assert.equal(remove.ok, false);
    assert.equal(remove.status, 403);
  });

  it('lets an admin promote and stops demoting the owner', () => {
    assert.equal(authorizeGroupAction({
      action: 'promote', actorId: 2, actorRole: 'admin', targetId: 3, targetRole: 'member', ownerId: 1, isGroup: true,
    }).ok, true);
    const demote = authorizeGroupAction({
      action: 'demote', actorId: 2, actorRole: 'admin', targetId: 1, targetRole: 'admin', ownerId: 1, adminCount: 2, isGroup: true,
    });
    assert.equal(demote.ok, false);
  });

  it('only lets the owner transfer ownership', () => {
    assert.equal(authorizeGroupAction({
      action: 'transfer', actorId: 2, actorRole: 'admin', targetId: 3, targetRole: 'member', ownerId: 1, isGroup: true,
    }).ok, false);
    assert.equal(authorizeGroupAction({
      action: 'transfer', actorId: 1, actorRole: 'admin', targetId: 3, targetRole: 'member', ownerId: 1, isGroup: true,
    }).ok, true);
  });
});

describe('viewing conversation', () => {
  it('detects a socket that is in both the user room and the conversation room', () => {
    const rooms = new Map([
      ['5', new Set(['sock-a'])],
      ['conversation-9', new Set(['sock-a', 'sock-b'])],
    ]);
    const io = { sockets: { adapter: { rooms } } };
    assert.equal(userIsViewingConversation(io, 5, 9), true);
    assert.equal(userIsViewingConversation(io, 6, 9), false);
  });
});
