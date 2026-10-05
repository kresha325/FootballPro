'use strict';

const { Op } = require('sequelize');
const sequelize = require('../../config/database');
const { Product, Order, Payment, CartItem } = require('../../models');
const { normalizeOrderCart } = require('../../utils/orderCart');
const { nextStockFields } = require('../../utils/productStock');
const {
  getMarketplaceFeePercent,
  getPlatformUserId,
  priceToJoncoinCents,
  splitGross,
  fromCents,
  toCents,
} = require('../../config/economy');
const { postLedgerEntry, lockUsers, economyError } = require('./ledger');
const { purchaseBlockReason, assertStatusTransition, isRecognizedSaleStatus, claimUnits } = require('./rules');

const DELIVERY_METHODS = new Set(['pickup', 'shipping', 'meetup']);
const REFUNDABLE = new Set(['paid', 'processing', 'shipped', 'delivered']);

function isUniqueError(err) {
  return err?.name === 'SequelizeUniqueConstraintError' || err?.original?.code === '23505';
}

async function restoreStock(order, transaction) {
  if (order.stockRestored) return;
  const lines = Array.isArray(order.products) ? order.products : [];
  const ids = [...new Set(lines.map((line) => Number(line?.productId)).filter((id) => id > 0))].sort((a, b) => a - b);
  for (const productId of ids) {
    const quantity = lines
      .filter((line) => Number(line?.productId) === productId)
      .reduce((sum, line) => sum + (parseInt(String(line?.quantity || 0), 10) || 0), 0);
    if (quantity < 1) continue;
    const product = await Product.findByPk(productId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!product) continue;
    const stockN = parseInt(String(product.stock ?? 0), 10);
    const base = Number.isFinite(stockN) ? stockN : 0;
    const fields = nextStockFields(product.stock, product.outOfStockAt, base + quantity);
    if (fields.stock > 0 && (product.status === 'out_of_stock' || !product.status)) {
      fields.status = 'active';
    }
    await product.update(fields, { transaction });
  }
  order.stockRestored = true;
}

async function loadLockedProducts(sortedProductIds, quantityByProductId, buyerId, transaction) {
  const locked = [];
  for (const productId of sortedProductIds) {
    const product = await Product.findByPk(productId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!product) throw economyError(404, 'Produkti nuk u gjet');
    if (Number(product.sellerId) === Number(buyerId)) {
      throw economyError(400, 'Nuk mund të blesh produktin tënd');
    }
    const quantity = quantityByProductId[productId];
    const reason = purchaseBlockReason(product, quantity);
    if (reason) throw economyError(400, reason);
    const unitCents = priceToJoncoinCents(product.price);
    locked.push({ product, quantity, unitCents });
  }
  return locked;
}

function groupBySeller(locked) {
  const bySeller = new Map();
  for (const row of locked) {
    const sellerId = Number(row.product.sellerId);
    if (!bySeller.has(sellerId)) bySeller.set(sellerId, []);
    bySeller.get(sellerId).push(row);
  }
  return bySeller;
}

async function quoteLines(lines) {
  const cart = normalizeOrderCart(lines);
  if (!cart.ok) throw economyError(cart.status, cart.msg);
  const feePercent = getMarketplaceFeePercent();
  const items = [];
  const sellers = new Map();
  for (const productId of cart.sortedProductIds) {
    const product = await Product.findByPk(productId);
    const quantity = cart.quantityByProductId[productId];
    const reason = product ? purchaseBlockReason(product, quantity) : 'Produkti nuk u gjet';
    const unitCents = product ? priceToJoncoinCents(product.price) : null;
    const lineCents = reason || unitCents == null ? 0 : unitCents * quantity;
    const sellerId = product ? Number(product.sellerId) : 0;
    if (!sellers.has(sellerId)) sellers.set(sellerId, 0);
    if (!reason) sellers.set(sellerId, sellers.get(sellerId) + lineCents);
    items.push({
      productId,
      quantity,
      name: product?.name || 'Produkt',
      price: product && toCents(product.price) != null ? fromCents(toCents(product.price)) : null,
      joncoinPrice: unitCents == null ? null : fromCents(unitCents),
      currency: 'JON',
      imageUrl: product?.imageUrl || '',
      sellerId: sellerId || null,
      maxStock: product?.stock == null ? 0 : parseInt(String(product.stock), 10) || 0,
      lineTotal: fromCents(lineCents),
      purchasable: !reason,
      unavailableReason: reason,
      status: product?.status || null,
    });
  }
  let gross = 0;
  let fee = 0;
  for (const sellerGross of sellers.values()) {
    const split = splitGross(sellerGross, feePercent);
    gross += split.grossCents;
    fee += split.feeCents;
  }
  return {
    items,
    subtotal: fromCents(gross),
    platformFee: fromCents(fee),
    sellerNet: fromCents(gross - fee),
    total: fromCents(gross),
    currency: 'JON',
    feePercent,
    feePayer: 'seller',
  };
}

async function checkout({
  buyerId,
  products,
  deliveryMethod,
  deliveryAddress,
  buyerContact,
  deliveryNotes,
  idempotencyKey,
}) {
  const method = String(deliveryMethod || 'meetup').toLowerCase();
  if (!DELIVERY_METHODS.has(method)) throw economyError(400, 'Metoda e dërgesës është e pavlefshme');
  if (method === 'shipping' && !String(deliveryAddress || '').trim()) {
    throw economyError(400, 'Vendos adresën e dërgesës');
  }
  if (!String(buyerContact || '').trim()) throw economyError(400, 'Vendos kontaktin që shitësi të të kontaktojë');

  const cart = normalizeOrderCart(products);
  if (!cart.ok) throw economyError(cart.status, cart.msg);
  const key = idempotencyKey ? String(idempotencyKey).trim().slice(0, 120) : null;

  try {
    return await sequelize.transaction(async (t) => {
      if (key) {
        const existing = await Order.findAll({
          where: { userId: buyerId, idempotencyKey: key },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (existing.length) return { orders: existing, duplicate: true };
      }

      const locked = await loadLockedProducts(cart.sortedProductIds, cart.quantityByProductId, buyerId, t);
      const bySeller = groupBySeller(locked);
      const feePercent = getMarketplaceFeePercent();
      const platformId = getPlatformUserId();
      const userIds = [buyerId, ...bySeller.keys()];
      if (platformId) userIds.push(platformId);
      await lockUsers(userIds, t);

      const orders = [];
      for (const [sellerId, rows] of bySeller) {
        let gross = 0;
        const lines = rows.map((row) => {
          const lineCents = row.unitCents * row.quantity;
          gross += lineCents;
          return {
            productId: row.product.id,
            quantity: row.quantity,
            price: fromCents(row.unitCents),
            name: row.product.name || 'Produkt',
            sellerId,
          };
        });
        const split = splitGross(gross, feePercent);
        const payment = await Payment.create(
          {
            userId: buyerId,
            amount: fromCents(split.grossCents),
            currency: 'JON',
            description: 'Marketplace XCoin checkout',
            status: 'pending',
          },
          { transaction: t }
        );
        const order = await Order.create(
          {
            userId: buyerId,
            sellerId,
            products: lines,
            totalAmount: fromCents(split.grossCents),
            grossAmount: fromCents(split.grossCents),
            platformFeeAmount: fromCents(split.feeCents),
            sellerNetAmount: fromCents(split.netCents),
            currency: 'JON',
            paymentMethod: 'joncoin',
            status: 'payment_pending',
            paymentId: payment.id,
            idempotencyKey: key,
            deliveryMethod: method,
            deliveryAddress: String(deliveryAddress || '').trim() || null,
            buyerContact: String(buyerContact || '').trim(),
            deliveryNotes: String(deliveryNotes || '').trim() || null,
            stockRestored: false,
          },
          { transaction: t }
        );

        await postLedgerEntry(
          {
            userId: buyerId,
            type: 'spend',
            amountCents: split.grossCents,
            status: 'completed',
            idempotencyKey: `order:${order.id}:buyer:spend`,
            relatedEntityType: 'order',
            relatedEntityId: order.id,
            description: `Marketplace purchase #${order.id}`,
          },
          t
        );
        if (split.netCents > 0) {
          await postLedgerEntry(
            {
              userId: sellerId,
              type: 'sale',
              amountCents: split.netCents,
              status: 'completed',
              idempotencyKey: `order:${order.id}:seller:sale`,
              relatedEntityType: 'order_sale',
              relatedEntityId: order.id,
              description: `Sale proceeds order #${order.id}`,
            },
            t
          );
        }
        if (split.feeCents > 0 && platformId && platformId !== sellerId) {
          await postLedgerEntry(
            {
              userId: platformId,
              type: 'reward',
              amountCents: split.feeCents,
              status: 'completed',
              idempotencyKey: `order:${order.id}:platform:fee`,
              relatedEntityType: 'platform_fee',
              relatedEntityId: order.id,
              description: `Marketplace fee order #${order.id}`,
            },
            t
          );
        }

        for (const row of rows) {
          const stockN = parseInt(String(row.product.stock ?? 0), 10) || 0;
          const claim = claimUnits(stockN, row.quantity);
          if (!claim.ok) throw economyError(400, 'Nuk ka stok të mjaftueshëm');
          const nextStock = claim.available;
          const fields = nextStockFields(row.product.stock, row.product.outOfStockAt, nextStock);
          if (nextStock <= 0) fields.status = 'out_of_stock';
          else if (row.product.status === 'out_of_stock') fields.status = 'active';
          await row.product.update(fields, { transaction: t });
        }

        await payment.update({ status: 'completed', description: `Marketplace order #${order.id}` }, { transaction: t });
        await order.update({ status: 'paid', paidAt: new Date(), confirmedAt: new Date() }, { transaction: t });
        orders.push(order);
      }

      if (CartItem) {
        await CartItem.destroy({
          where: { userId: buyerId, productId: { [Op.in]: cart.sortedProductIds } },
          transaction: t,
        });
      }
      return { orders, duplicate: false };
    });
  } catch (err) {
    if (key && isUniqueError(err)) {
      const existing = await Order.findAll({ where: { userId: buyerId, idempotencyKey: key } });
      if (existing.length) return { orders: existing, duplicate: true };
    }
    throw err;
  }
}

async function settlePendingOrder(orderId, actor) {
  return sequelize.transaction(async (t) => {
    const order = await Order.findByPk(orderId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!order) throw economyError(404, 'Porosia nuk u gjet');
    const isSeller = Number(order.sellerId) === Number(actor.id);
    if (!isSeller && actor.role !== 'admin') throw economyError(403, 'Vetëm shitësi mund ta pranojë porosinë');
    if (order.status === 'paid') return { order, duplicate: true };
    if (order.status !== 'pending' && order.status !== 'payment_pending') {
      throw economyError(400, 'Porosia nuk është në pritje');
    }
    const gross = toCents(order.grossAmount || order.totalAmount);
    if (gross == null || gross <= 0) throw economyError(400, 'Totali i porosisë është i pavlefshëm');
    const split = splitGross(gross, getMarketplaceFeePercent());
    const platformId = getPlatformUserId();
    await lockUsers([order.userId, order.sellerId, platformId].filter(Boolean), t);

    await postLedgerEntry(
      {
        userId: order.userId,
        type: 'spend',
        amountCents: split.grossCents,
        status: 'completed',
        idempotencyKey: `order:${order.id}:buyer:spend`,
        relatedEntityType: 'order',
        relatedEntityId: order.id,
        description: `Marketplace purchase #${order.id}`,
      },
      t
    );
    if (split.netCents > 0) {
      await postLedgerEntry(
        {
          userId: order.sellerId,
          type: 'sale',
          amountCents: split.netCents,
          status: 'completed',
          idempotencyKey: `order:${order.id}:seller:sale`,
          relatedEntityType: 'order_sale',
          relatedEntityId: order.id,
          description: `Sale proceeds order #${order.id}`,
        },
        t
      );
    }
    if (split.feeCents > 0 && platformId && platformId !== Number(order.sellerId)) {
      await postLedgerEntry(
        {
          userId: platformId,
          type: 'reward',
          amountCents: split.feeCents,
          status: 'completed',
          idempotencyKey: `order:${order.id}:platform:fee`,
          relatedEntityType: 'platform_fee',
          relatedEntityId: order.id,
          description: `Marketplace fee order #${order.id}`,
        },
        t
      );
    }
    if (order.paymentId) {
      const payment = await Payment.findByPk(order.paymentId, { transaction: t });
      if (payment && payment.status !== 'completed') {
        await payment.update({ status: 'completed', description: `Marketplace order #${order.id} confirmed` }, { transaction: t });
      }
    }
    await order.update(
      {
        status: 'paid',
        paidAt: order.paidAt || new Date(),
        confirmedAt: new Date(),
        grossAmount: fromCents(split.grossCents),
        platformFeeAmount: fromCents(split.feeCents),
        sellerNetAmount: fromCents(split.netCents),
        currency: 'JON',
        paymentMethod: order.paymentMethod || 'joncoin',
      },
      { transaction: t }
    );
    return { order, duplicate: false };
  });
}

async function cancelPendingOrder(orderId, actor) {
  return sequelize.transaction(async (t) => {
    const order = await Order.findByPk(orderId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!order) throw economyError(404, 'Porosia nuk u gjet');
    assertStatusTransition(order.status, 'cancelled', actor, order);
    await restoreStock(order, t);
    if (order.paymentId) {
      const payment = await Payment.findByPk(order.paymentId, { transaction: t });
      if (payment && payment.status === 'pending') await payment.update({ status: 'failed' }, { transaction: t });
    }
    await order.update({ status: 'cancelled', cancelledAt: new Date(), stockRestored: true }, { transaction: t });
    return order;
  });
}

async function transitionOrder(orderId, nextStatus, actor) {
  const status = String(nextStatus || '').toLowerCase();
  if (status === 'cancelled') return cancelPendingOrder(orderId, actor);
  if (status === 'refunded') return refundOrder(orderId, actor);
  if (status === 'paid') throw economyError(400, 'Pagesa nuk vendoset nga statusi. Përdor checkout.');
  return sequelize.transaction(async (t) => {
    const order = await Order.findByPk(orderId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!order) throw economyError(404, 'Porosia nuk u gjet');
    assertStatusTransition(order.status, status, actor, order);
    const patch = { status };
    if (status === 'shipped') patch.shippedAt = order.shippedAt || new Date();
    if (status === 'delivered') patch.deliveredAt = new Date();
    await order.update(patch, { transaction: t });
    return order;
  });
}

async function refundOrder(orderId, actor) {
  return sequelize.transaction(async (t) => {
    const order = await Order.findByPk(orderId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!order) throw economyError(404, 'Porosia nuk u gjet');
    if (order.status === 'refunded') return { order, duplicate: true };
    if (!REFUNDABLE.has(order.status)) throw economyError(400, 'Kjo porosi nuk rimbursohet');
    assertStatusTransition(order.status, 'refunded', actor, order);
    await restoreStock(order, t);

    const gross = toCents(order.grossAmount || order.totalAmount);
    const net = toCents(order.sellerNetAmount || order.totalAmount);
    const fee = toCents(order.platformFeeAmount || 0) || 0;
    if (gross == null || gross <= 0 || net == null || net < 0) throw economyError(400, 'Shuma e rimbursimit është e pavlefshme');
    const platformId = getPlatformUserId();
    await lockUsers([order.userId, order.sellerId, fee > 0 ? platformId : null].filter(Boolean), t);

    await postLedgerEntry(
      {
        userId: order.userId,
        type: 'refund',
        amountCents: gross,
        status: 'completed',
        idempotencyKey: `order:${order.id}:buyer:refund`,
        relatedEntityType: 'order_refund',
        relatedEntityId: order.id,
        description: `Refund order #${order.id}`,
      },
      t
    );
    if (net > 0) {
      await postLedgerEntry(
        {
          userId: order.sellerId,
          type: 'reversal',
          amountCents: net,
          status: 'completed',
          idempotencyKey: `order:${order.id}:seller:reversal`,
          relatedEntityType: 'order_refund',
          relatedEntityId: order.id,
          description: `Sale reversal order #${order.id}`,
        },
        t
      );
    }
    if (fee > 0 && platformId && platformId !== Number(order.sellerId)) {
      await postLedgerEntry(
        {
          userId: platformId,
          type: 'reversal',
          amountCents: fee,
          status: 'completed',
          idempotencyKey: `order:${order.id}:platform:reversal`,
          relatedEntityType: 'platform_fee_reversal',
          relatedEntityId: order.id,
          description: `Fee reversal order #${order.id}`,
          allowNegative: false,
        },
        t
      );
    }

    if (order.paymentId) {
      const payment = await Payment.findByPk(order.paymentId, { transaction: t });
      if (payment) {
        await payment.update(
          { description: `Refunded order #${order.id}. Original charge remains on the ledger.` },
          { transaction: t }
        );
      }
    }
    await order.update({ status: 'refunded', refundedAt: new Date(), stockRestored: true }, { transaction: t });
    return { order, duplicate: false };
  });
}

async function sellerSummary(sellerId) {
  const { getCompletedLedgerBalance } = require('./ledger');
  const orders = await Order.findAll({ where: { sellerId } });
  let gross = 0;
  let fees = 0;
  let net = 0;
  let recognized = 0;
  let delivered = 0;
  let refunded = 0;
  for (const order of orders) {
    if (isRecognizedSaleStatus(order.status)) {
      recognized += 1;
      if (order.status === 'delivered') delivered += 1;
      gross += toCents(order.grossAmount || order.totalAmount) || 0;
      fees += toCents(order.platformFeeAmount || 0) || 0;
      net += toCents(order.sellerNetAmount || order.totalAmount) || 0;
    } else if (order.status === 'refunded') {
      refunded += 1;
    }
  }
  const sellerBalance = await getCompletedLedgerBalance(sellerId);
  return {
    grossSales: fromCents(gross),
    platformFees: fromCents(fees),
    netAmount: fromCents(net),
    sellerBalance,
    currency: 'JON',
    recognizedOrders: recognized,
    completedOrders: delivered,
    refundedOrders: refunded,
  };
}

module.exports = {
  quoteLines,
  checkout,
  settlePendingOrder,
  cancelPendingOrder,
  transitionOrder,
  refundOrder,
  sellerSummary,
};
