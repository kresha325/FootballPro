/**
 * Find an existing 1:1 conversation. Groups that happen to contain both users are excluded.
 */
const DIRECT_PAIR_SQL = `
  SELECT cm."conversationId" AS "conversationId"
  FROM "ConversationMembers" cm
  INNER JOIN "Conversations" c ON c.id = cm."conversationId"
  WHERE cm."userId" IN (:a, :b)
    AND (c."isGroup" = false OR c."isGroup" IS NULL)
  GROUP BY cm."conversationId"
  HAVING COUNT(DISTINCT cm."userId") = 2
  LIMIT 1
`;

function pairKey(userA, userB) {
  const a = Number(userA);
  const b = Number(userB);
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return `${lo}:${hi}`;
}

function conversationIdFromRow(row) {
  if (!row) return null;
  return row.conversationId || row.conversationid || row.conversation_id || null;
}

module.exports = {
  DIRECT_PAIR_SQL,
  pairKey,
  conversationIdFromRow,
};
