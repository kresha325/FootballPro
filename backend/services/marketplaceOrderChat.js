const { QueryTypes } = require('sequelize');
const { User } = require('../models');
const { Conversation, ConversationMember } = require('../models/Conversation');
const Message = require('../models/Message');

/**
 * Gjen ose krijon bisedë 1-me-1 midis dy përdoruesve (i njëjti SQL si messaging).
 */
async function getOrCreateDirectConversationId(sequelize, userA, userB) {
  if (!userA || !userB || userA === userB) return null;

  const sql = `SELECT "conversationId" FROM "ConversationMembers" WHERE "userId" IN (:a,:b) GROUP BY "conversationId" HAVING COUNT("userId") = 2 LIMIT 1`;
  const convoMatches = await sequelize.query(sql, {
    replacements: { a: userA, b: userB },
    type: QueryTypes.SELECT,
  });

  if (convoMatches && convoMatches.length > 0) {
    const row = convoMatches[0];
    const id = row.conversationId != null ? row.conversationId : row.conversationid;
    if (id != null) return id;
  }

  const t = await sequelize.transaction();
  try {
    const conv = await Conversation.create({ isGroup: false }, { transaction: t });
    await ConversationMember.bulkCreate(
      [
        { conversationId: conv.id, userId: userA },
        { conversationId: conv.id, userId: userB },
      ],
      { transaction: t }
    );
    await t.commit();
    return conv.id;
  } catch (e) {
    await t.rollback();
    throw e;
  }
}

/**
 * Dërgo mesazh te shitësi pasi porosia (JonCoin) u krye me sukses.
 * Nuk hedh gabim lart (vetëm log) që të mos dështojë përgjigjja e porosisë.
 */
async function sendPurchaseNoticeToSeller(sequelize, { buyerId, sellerId, orderId, lines, sellerTotal }) {
  const convId = await getOrCreateDirectConversationId(sequelize, buyerId, sellerId);
  if (!convId) return;

  const buyer = await User.findByPk(buyerId, { attributes: ['id', 'firstName', 'lastName'] });
  const buyerName = [buyer?.firstName, buyer?.lastName].filter(Boolean).join(' ').trim() || `User #${buyerId}`;

  const lineParts = (lines || []).map(
    (l) => `• ${l.name} × ${l.quantity} = ${l.lineTotal} JonCoin`
  );
  const text = [
    `Blerje e re — Porosi #${orderId}`,
    `Blerësi: ${buyerName}`,
    '',
    lineParts.join('\n'),
    '',
    `Nëntotali (për ty): ${sellerTotal} JonCoin`,
  ].join('\n');

  await Message.create({
    conversationId: convId,
    senderId: buyerId,
    content: text,
    type: 'text',
  });
  await Conversation.update({ lastMessageAt: new Date() }, { where: { id: convId } });
}

/**
 * Grupon linjat sipas shitësit dhe dërgon një mesazh për shitës.
 * `lockedProducts` = [{ product: Sequelize instance, quantity }]
 */
async function notifySellersOfMarketplaceOrder(sequelize, { buyerId, orderId, lockedProducts }) {
  if (!Array.isArray(lockedProducts) || lockedProducts.length === 0) return;

  const bySeller = new Map();
  for (const { product, quantity } of lockedProducts) {
    if (!product) continue;
    const sid = product.sellerId;
    if (sid == null || sid === buyerId) continue;
    const price = parseFloat(product.price);
    const p = Number.isFinite(price) ? price : 0;
    const lineTotal = Math.round(p * quantity * 100) / 100;
    if (!bySeller.has(sid)) {
      bySeller.set(sid, { lines: [], total: 0 });
    }
    const entry = bySeller.get(sid);
    entry.lines.push({
      name: product.name || 'Produkt',
      quantity,
      lineTotal,
    });
    entry.total = Math.round((entry.total + lineTotal) * 100) / 100;
  }

  for (const [sellerId, { lines, total }] of bySeller) {
    try {
      await sendPurchaseNoticeToSeller(sequelize, {
        buyerId,
        sellerId,
        orderId,
        lines,
        sellerTotal: total,
      });
    } catch (e) {
      console.error('notifySellersOfMarketplaceOrder:', e && e.message, e);
    }
  }
}

module.exports = {
  notifySellersOfMarketplaceOrder,
  getOrCreateDirectConversationId,
};
