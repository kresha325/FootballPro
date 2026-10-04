const { QueryTypes } = require('sequelize');

const UNREAD_WHERE = `
  m."senderId" <> :userId
  AND m."deleted" = false
  AND m."createdAt" > COALESCE(cm."lastReadAt", TIMESTAMP '1970-01-01')
`;

async function sumUnreadForUser(sequelize, userId) {
  const rows = await sequelize.query(
    `
    SELECT COUNT(*)::int AS "count"
    FROM "Messages" m
    INNER JOIN "ConversationMembers" cm
      ON cm."conversationId" = m."conversationId"
     AND cm."userId" = :userId
    WHERE ${UNREAD_WHERE}
    `,
    { replacements: { userId }, type: QueryTypes.SELECT }
  );
  return Number(rows?.[0]?.count || 0);
}

async function unreadCountsByConversation(sequelize, userId, conversationIds) {
  const map = new Map();
  if (!conversationIds?.length) return map;
  const rows = await sequelize.query(
    `
    SELECT m."conversationId" AS "conversationId", COUNT(*)::int AS "count"
    FROM "Messages" m
    INNER JOIN "ConversationMembers" cm
      ON cm."conversationId" = m."conversationId"
     AND cm."userId" = :userId
    WHERE m."conversationId" IN (:ids)
      AND ${UNREAD_WHERE}
    GROUP BY m."conversationId"
    `,
    { replacements: { userId, ids: conversationIds }, type: QueryTypes.SELECT }
  );
  for (const row of rows) {
    const id = Number(row.conversationId ?? row.conversationid);
    map.set(id, Number(row.count) || 0);
  }
  return map;
}

module.exports = {
  sumUnreadForUser,
  unreadCountsByConversation,
};
