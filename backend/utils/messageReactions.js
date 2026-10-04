const ALLOWED_REACTION_EMOJIS = ['❤️', '👍', '😂', '🔥', '👏', '😮', '😢'];
const ALLOWED_SET = new Set(ALLOWED_REACTION_EMOJIS);

function normalizeReactionEmoji(value) {
  const emoji = String(value || '').trim();
  if (!ALLOWED_SET.has(emoji)) return null;
  return emoji;
}

/**
 * One row per (message, user, emoji). Clicking an existing row removes it.
 */
function reactionToggleDecision(existingRow) {
  return existingRow ? 'remove' : 'add';
}

function summarizeReactions(rows, currentUserId) {
  const map = new Map();
  for (const row of rows || []) {
    const emoji = row.emoji;
    if (!emoji) continue;
    if (!map.has(emoji)) map.set(emoji, { emoji, count: 0, mine: false });
    const group = map.get(emoji);
    group.count += 1;
    if (currentUserId != null && Number(row.userId) === Number(currentUserId)) {
      group.mine = true;
    }
  }
  return ALLOWED_REACTION_EMOJIS
    .filter((emoji) => map.has(emoji))
    .map((emoji) => map.get(emoji));
}

function redactReply(reply) {
  if (!reply) return null;
  if (reply.deleted) {
    return {
      id: reply.id,
      deleted: true,
      unavailable: true,
      content: null,
      fileUrl: null,
      fileName: null,
      type: reply.type || null,
      sender: reply.sender || null,
    };
  }
  return reply;
}

module.exports = {
  ALLOWED_REACTION_EMOJIS,
  normalizeReactionEmoji,
  reactionToggleDecision,
  summarizeReactions,
  redactReply,
};
