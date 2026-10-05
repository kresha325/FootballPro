'use strict';

const { notify } = require('./service');
const {
  idempotencyKey,
  orderEventForStatus,
  walletEventFor,
} = require('./policy');

async function safeNotify(input) {
  try {
    return await notify(input);
  } catch (err) {
    console.warn('notification event failed:', err?.message || err);
    return null;
  }
}

function orderCopy(eventType, order) {
  const id = order?.id;
  const map = {
    ORDER_CREATED: ['Porosi e re', `Porosia #${id} u krijua.`],
    ORDER_ACCEPTED: ['Porosia u pranua', `Porosia #${id} u pranua.`],
    ORDER_SHIPPED: ['Porosia u dërgua', `Porosia #${id} u dërgua.`],
    ORDER_COMPLETED: ['Porosia u përfundua', `Porosia #${id} u përfundua.`],
    ORDER_CANCELLED: ['Porosia u anulua', `Porosia #${id} u anulua.`],
    REFUND: ['Rimbursim', `Porosia #${id} u rimbursua.`],
    PAYMENT_STATUS: ['Pagesa', `Statusi i pagesës për porosinë #${id} u përditësua.`],
  };
  const [title, message] = map[eventType] || map.PAYMENT_STATUS;
  return { title, message };
}

function walletCopy(eventType, tx) {
  const amount = tx?.amount != null ? tx.amount : '';
  const map = {
    WALLET_RECEIVED: ['XCoin u shtua', `Mora ${amount} XCoin.`],
    WALLET_SPENT: ['XCoin u shpenzua', `U shpenzuan ${amount} XCoin.`],
    WALLET_WITHDRAWAL: ['Tërheqje XCoin', `Kërkesa për tërheqje prej ${amount} XCoin u regjistrua.`],
    WALLET_REFUND: ['Rimbursim XCoin', `U kthye ${amount} XCoin.`],
    WALLET_TRANSACTION: ['Transaksion XCoin', `Transaksioni ${tx?.type || ''} u përditësua.`],
  };
  const [title, message] = map[eventType] || map.WALLET_TRANSACTION;
  return { title, message };
}

async function notifyOrderParties(order, { actorId } = {}) {
  if (!order?.id) return;
  const eventType = orderEventForStatus(order.status);
  const copy = orderCopy(eventType, order);
  const recipients = new Set(
    [Number(order.userId), Number(order.sellerId)].filter((id) => Number.isFinite(id) && id > 0)
  );
  for (const userId of recipients) {
    const self = Number(actorId) === userId;
    if (self && eventType !== 'ORDER_CREATED') continue;
    await safeNotify({
      userId,
      actorId: self ? null : actorId || null,
      allowSelf: eventType === 'ORDER_CREATED',
      eventType,
      title: userId === Number(order.sellerId) && eventType === 'ORDER_CREATED' ? 'Porosi e re për shitje' : copy.title,
      message: userId === Number(order.sellerId) && eventType === 'ORDER_CREATED'
        ? `Ke një porosi të re #${order.id}.`
        : copy.message,
      entityType: 'order',
      entityId: order.id,
      idempotencyKey: idempotencyKey(['order', order.id, eventType, 'user', userId]),
      metadata: { status: order.status, orderId: order.id },
    });
  }
}

async function notifyWallet(tx) {
  if (!tx?.id || !tx.userId) return null;
  const eventType = walletEventFor(tx);
  const copy = walletCopy(eventType, tx);
  return safeNotify({
    userId: tx.userId,
    allowSelf: true,
    eventType,
    title: copy.title,
    message: copy.message,
    entityType: 'wallet',
    entityId: tx.id,
    idempotencyKey: idempotencyKey(['wallet', tx.id, tx.status || 'tx', 'user', tx.userId]),
    metadata: { txType: tx.type, status: tx.status, amount: tx.amount },
  });
}

async function notifyAchievement(userId, achievement) {
  if (!userId || !achievement?.id) return null;
  return safeNotify({
    userId,
    allowSelf: true,
    eventType: 'PLAYER_ACHIEVEMENT',
    title: 'Arritje e re',
    message: achievement.name
      ? `Zhbllokove arritjen «${achievement.name}».`
      : 'Zhbllokove një arritje të re.',
    entityType: 'player',
    entityId: userId,
    idempotencyKey: idempotencyKey(['achievement', achievement.id, 'user', userId]),
    metadata: { achievementId: achievement.id },
  });
}

async function notifyShortlist({ scoutId, playerId, shortlistId }) {
  if (!playerId || !scoutId || Number(playerId) === Number(scoutId)) return null;
  return safeNotify({
    userId: playerId,
    actorId: scoutId,
    eventType: 'SCOUT_SHORTLISTED',
    title: 'Shortlistë skautimi',
    message: 'Një skaut të shtoi në shortlistë.',
    entityType: 'scouting',
    entityId: playerId,
    link: '/scouting',
    idempotencyKey: idempotencyKey(['shortlist', shortlistId || playerId, 'scout', scoutId, 'player', playerId]),
    metadata: { scoutId, shortlistId: shortlistId || null },
  });
}

async function notifyWatchChange({ scoutId, player, change, watchlistId }) {
  if (!scoutId) return null;
  const name = `${player?.firstName || ''} ${player?.lastName || ''}`.trim() || 'Lojtari';
  return safeNotify({
    userId: scoutId,
    actorId: player?.id || null,
    eventType: change?.type === 'performance' ? 'SCOUT_PERFORMANCE' : 'SCOUT_WATCHLIST',
    title: 'Watchlist',
    message: `${name}: ${change?.summary || 'përditësim'}`,
    entityType: 'scouting',
    entityId: player?.id || null,
    link: '/scouting',
    idempotencyKey: idempotencyKey([
      'watch',
      watchlistId || player?.id,
      change?.type || 'change',
      'user',
      scoutId,
    ]),
    metadata: { changeType: change?.type, ...(change?.payload || {}) },
  });
}

async function notifyPasswordChanged(userId) {
  return safeNotify({
    userId,
    allowSelf: true,
    eventType: 'PASSWORD_CHANGED',
    title: 'Fjalëkalimi u ndryshua',
    message: 'Fjalëkalimi i llogarisë suaj sapo u ndryshua. Nëse nuk ishe ti, rivendos hyrjen.',
    entityType: 'user',
    entityId: userId,
    link: '/settings',
    idempotencyKey: idempotencyKey(['password', userId, Date.now()]),
  });
}

async function notifyVerification(userId, kind) {
  return safeNotify({
    userId,
    allowSelf: true,
    eventType: 'VERIFICATION_STATUS',
    title: 'Statusi i verifikimit',
    message: kind === 'parent'
      ? 'Verifikimi i prindit u konfirmua.'
      : kind === 'admin'
        ? 'Llogaria jote u verifikua.'
        : 'Klubi të verifikoi.',
    entityType: 'player',
    entityId: userId,
    link: `/profile/${userId}`,
    idempotencyKey: idempotencyKey(['verification', kind || 'status', 'user', userId]),
  });
}

async function notifyProfileViewed({ viewerId, profileUserId }) {
  const day = new Date().toISOString().slice(0, 10);
  return safeNotify({
    userId: profileUserId,
    actorId: viewerId,
    eventType: 'PROFILE_VIEWED',
    title: 'Profili yt u pa',
    message: 'Dikush pa profilin tënd.',
    entityType: 'player',
    entityId: profileUserId,
    link: `/profile/${profileUserId}`,
    idempotencyKey: idempotencyKey(['profile-view', viewerId, 'user', profileUserId, day]),
  });
}

module.exports = {
  safeNotify,
  notifyOrderParties,
  notifyWallet,
  notifyAchievement,
  notifyShortlist,
  notifyWatchChange,
  notifyPasswordChanged,
  notifyVerification,
  notifyProfileViewed,
};
