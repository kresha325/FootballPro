/**
 * Conversation membership ACL helpers (testable without full controller).
 */

async function findConversationMembership(ConversationMember, { conversationId, userId }) {
  if (!ConversationMember?.findOne) {
    throw new Error('ConversationMember model required');
  }
  return ConversationMember.findOne({
    where: { conversationId, userId },
  });
}

/**
 * @returns {{ ok: true, membership: object } | { ok: false, status: number, msg: string }}
 */
async function requireConversationMember(ConversationMember, { conversationId, userId }) {
  if (userId == null) {
    return { ok: false, status: 401, msg: 'Nuk jeni i autentikuar' };
  }
  if (conversationId == null || conversationId === '') {
    return { ok: false, status: 400, msg: 'conversationId është i detyrueshëm' };
  }

  const membership = await findConversationMembership(ConversationMember, {
    conversationId,
    userId,
  });

  if (!membership) {
    return { ok: false, status: 403, msg: 'Nuk jeni anëtar i kësaj bisede' };
  }

  return { ok: true, membership };
}

module.exports = {
  findConversationMembership,
  requireConversationMember,
};
