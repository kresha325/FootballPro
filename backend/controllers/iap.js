const https = require('https');
const sequelize = require('../config/database');
const IapPurchase = require('../models/IapPurchase');
const User = require('../models/User');
const { JonCoinTransaction } = require('../models');
const { unverifiedIapAllowed } = require('../utils/iapPolicy');
const { verifyAppleSignedPayload } = require('../utils/appleJws');
const { verifyGooglePlayPurchase, getServiceAccount: getGoogleServiceAccount } = require('../utils/googlePlay');
const { PLANS, activatePremiumForUser } = require('./premium');

const APPLE_BUNDLE_ID = 'com.kresha325.xtalenti';

/** Store product catalog — must match App Store Connect / Play Console. */
const PRODUCT_CATALOG = {
  'com.kresha325.xtalenti.premium.monthly': {
    kind: 'premium',
    plan: 'monthly',
    consumable: false,
  },
  'com.kresha325.xtalenti.premium.yearly': {
    kind: 'premium',
    plan: 'yearly',
    consumable: false,
  },
  'com.kresha325.xtalenti.joncoin.100': {
    kind: 'joncoin',
    amount: 100,
    consumable: true,
  },
  'com.kresha325.xtalenti.joncoin.500': {
    kind: 'joncoin',
    amount: 500,
    consumable: true,
  },
  'com.kresha325.xtalenti.joncoin.1000': {
    kind: 'joncoin',
    amount: 1000,
    consumable: true,
  },
};

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => {
          raw += c;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw || '{}'));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function allowUnverifiedIap() {
  return unverifiedIapAllowed();
}

async function verifyAppleReceipt(receiptData) {
  const password = process.env.APPLE_IAP_SHARED_SECRET;
  if (!password) {
    return { ok: false, msg: 'APPLE_IAP_SHARED_SECRET mungon në server' };
  }
  const payload = {
    'receipt-data': receiptData,
    password,
    'exclude-old-transactions': true,
  };
  let result = await postJson('https://buy.itunes.apple.com/verifyReceipt', payload);
  if (result.status === 21007) {
    result = await postJson('https://sandbox.itunes.apple.com/verifyReceipt', payload);
  }
  if (result.status !== 0) {
    return { ok: false, msg: `Apple verify status ${result.status}`, raw: result };
  }
  return { ok: true, raw: result };
}

function validateAppleReceiptPayload(result, { productId, transactionId, isSubscription = false, now = Date.now() } = {}) {
  if (!result || result.status !== 0) {
    return { ok: false, msg: 'Receipt Apple nuk është i vlefshëm' };
  }
  if (result.receipt?.bundle_id !== APPLE_BUNDLE_ID) {
    return { ok: false, msg: 'Bundle ID në receipt nuk përputhet me XTALENTI' };
  }

  const entries = [
    ...(Array.isArray(result.latest_receipt_info) ? result.latest_receipt_info : []),
    ...(Array.isArray(result.receipt?.in_app) ? result.receipt.in_app : []),
  ];
  const match = entries.find((entry) =>
    String(entry?.product_id || '') === String(productId || '') &&
    String(entry?.transaction_id || '') === String(transactionId || '')
  );
  if (!match) {
    return { ok: false, msg: 'Receipt nuk përmban produktin dhe transaksionin e kërkuar' };
  }

  if (match.cancellation_date || match.cancellation_date_ms || match.revocation_date_ms) {
    return { ok: false, msg: 'Transaksioni Apple është anuluar ose revokuar' };
  }
  if (isSubscription) {
    const expiresAt = Number(match.expires_date_ms || 0);
    if (!Number.isFinite(expiresAt) || expiresAt <= now) {
      return { ok: false, msg: 'Abonimi Apple nuk është aktiv' };
    }
  }
  return { ok: true, verified: true, raw: match };
}

/**
 * StoreKit 2 sends a signed JWS in purchaseToken (jwsRepresentation). This
 * verifies the x5c certificate chain against Apple's Root CA and the ES256
 * signature before trusting the decoded payload — see utils/appleJws.js.
 */
function decodeAndVerifyAppleJws(jws, options) {
  const result = verifyAppleSignedPayload(jws, options);
  if (!result.ok) {
    return { payload: null, verified: false, msg: result.msg };
  }
  return { payload: result.payload, verified: true };
}

async function verifyApplePurchase({ transactionReceipt, purchaseToken, productId, transactionId, isSubscription = false, verificationOptions }) {
  const legacyReceipt =
    transactionReceipt ||
    (purchaseToken && !String(purchaseToken).includes('.') ? purchaseToken : null);

  if (legacyReceipt) {
    const verified = await verifyAppleReceipt(legacyReceipt);
    if (!verified.ok) return verified;
    return validateAppleReceiptPayload(verified.raw, { productId, transactionId, isSubscription });
  }

  if (purchaseToken && String(purchaseToken).includes('.')) {
    const { payload, verified, msg } = decodeAndVerifyAppleJws(purchaseToken, verificationOptions);
    if (!verified) {
      if (unverifiedIapAllowed()) {
        // Dev/sandbox-only escape hatch; never reachable in production (see iapPolicy.js).
        return { ok: true, jws: true, unverified: true };
      }
      return { ok: false, msg: msg || 'Verifikimi i JWS nga Apple dështoi' };
    }

    const jwsProduct = payload?.productId || payload?.product_id;
    const jwsBundle = payload?.bundleId || payload?.bundle_id;
    const jwsTx = payload?.transactionId || payload?.transaction_id;
    if (
      jwsProduct !== productId ||
      jwsBundle !== APPLE_BUNDLE_ID ||
      !jwsTx ||
      String(jwsTx) !== String(transactionId)
    ) {
      return { ok: false, msg: 'JWS i verifikuar nuk përputhet me produktin/transaksionin e kërkuar' };
    }
    if (isSubscription) {
      const expiresAt = Number(payload.expiresDate || payload.expires_date_ms || 0);
      const revokedAt = Number(payload.revocationDate || payload.revocation_date_ms || 0);
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || revokedAt > 0) {
        return { ok: false, msg: 'Abonimi Apple nuk është aktiv ose është revokuar' };
      }
    }
    return { ok: true, jws: true, verified: true, raw: payload };
  }

  if (allowUnverifiedIap() && process.env.NODE_ENV !== 'production') {
    return { ok: true, unverified: true };
  }
  return { ok: false, msg: 'Nuk u gjet receipt/JWS i vlefshëm për Apple' };
}

/**
 * Google Play verification via the Android Publisher API — see utils/googlePlay.js.
 * Falls back to the dev-only unverified path (IAP_ALLOW_UNVERIFIED=true, never
 * reachable in production per iapPolicy.js) only when no service account is
 * configured at all; a configured-but-failed verification is always rejected.
 */
async function verifyGooglePurchase({ productId, purchaseToken, isSubscription }) {
  if (!purchaseToken || !productId) {
    return { ok: false, msg: 'purchaseToken / productId mungojnë' };
  }

  if (getGoogleServiceAccount()) {
    return verifyGooglePlayPurchase({ productId, purchaseToken, isSubscription });
  }

  if (unverifiedIapAllowed()) {
    return { ok: true, unverified: true };
  }
  return {
    ok: false,
    msg: 'Google Play receipt verification nuk është konfiguruar. Blerjet nuk pranohen derisa Play Developer API të jetë aktive.',
  };
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function publicPurchase(purchase) {
  if (!purchase) return null;
  const row = purchase.toJSON ? purchase.toJSON() : purchase;
  return {
    id: row.id,
    userId: row.userId,
    platform: row.platform,
    productId: row.productId,
    transactionId: row.transactionId,
    kind: row.kind,
    status: row.status,
    createdAt: row.createdAt,
  };
}

function sendAlreadyProcessed(req, res, purchase) {
  const sameOwner = Number(purchase.userId) === Number(req.user.id);
  const sameProduct = purchase.productId === String(req.body?.productId || '');
  const samePlatform = purchase.platform === String(req.body?.platform || '').toLowerCase();
  if (!sameOwner || !sameProduct || !samePlatform || purchase.status !== 'completed') {
    return res.status(409).json({ msg: 'Ky transaksion është regjistruar tashmë për një blerje tjetër.' });
  }
  return res.json({
    success: true,
    alreadyProcessed: true,
    purchase: publicPurchase(purchase),
    msg: 'Blerja ishte tashmë e përpunuar',
  });
}

exports.getIapCatalog = async (_req, res) => {
  res.json({
    products: Object.entries(PRODUCT_CATALOG).map(([productId, meta]) => ({
      productId,
      ...meta,
      premiumDays: meta.plan ? PLANS[meta.plan]?.days : undefined,
    })),
  });
};

exports.verifyAndFulfill = async (req, res) => {
  try {
    const platform = String(req.body?.platform || '').toLowerCase();
    const productId = String(req.body?.productId || '');
    const transactionId = String(req.body?.transactionId || req.body?.id || '');
    const purchaseToken = req.body?.purchaseToken || null;
    const transactionReceipt = req.body?.transactionReceipt || null;

    const catalog = PRODUCT_CATALOG[productId];
    if (!catalog) {
      return res.status(400).json({ msg: 'Product ID i panjohur' });
    }
    if (!transactionId) {
      return res.status(400).json({ msg: 'transactionId është i detyrueshëm' });
    }
    if (!['ios', 'android'].includes(platform)) {
      return res.status(400).json({ msg: 'platform duhet ios|android' });
    }

    const existing = await IapPurchase.findOne({ where: { transactionId } });
    if (existing) {
      return sendAlreadyProcessed(req, res, existing);
    }

    if (platform === 'ios') {
      if (!transactionReceipt && !purchaseToken) {
        return res.status(400).json({ msg: 'transactionReceipt ose purchaseToken kërkohet për iOS' });
      }
      const verified = await verifyApplePurchase({
        transactionReceipt,
        purchaseToken,
        productId,
        transactionId,
        isSubscription: catalog.kind === 'premium',
      });
      if (!verified.ok) {
        return res.status(400).json({ msg: verified.msg || 'Verifikimi Apple dështoi' });
      }
    } else {
      const verified = await verifyGooglePurchase({
        productId,
        purchaseToken,
        isSubscription: catalog.kind === 'premium',
      });
      if (!verified.ok) {
        return res.status(400).json({ msg: verified.msg || 'Verifikimi Google dështoi' });
      }
    }

    const result = await sequelize.transaction(async (transaction) => {
      // The unique transactionId index is the cross-request claim. Creating
      // this row in the same transaction as fulfillment makes the claim and
      // entitlement/credit commit or roll back together.
      const purchase = await IapPurchase.create({
        userId: req.user.id,
        platform,
        productId,
        transactionId,
        purchaseToken,
        kind: catalog.kind,
        status: 'processing',
        rawPayload: { productId, transactionId, hasReceipt: !!transactionReceipt },
      }, { transaction });

      let fulfillment = null;
      let joncoinTx = null;
      if (catalog.kind === 'premium') {
        fulfillment = await activatePremiumForUser(req.user.id, catalog.plan, `iap:${transactionId}`, {
          source: 'iap',
          productId,
          iapPurchaseId: purchase.id,
          transaction,
        });
        if (!fulfillment) {
          const missingUser = new Error('Përdoruesi nuk u gjet');
          missingUser.code = 'IAP_USER_NOT_FOUND';
          throw missingUser;
        }
        if (fulfillment.invoice) {
          fulfillment.invoice.iapPurchaseId = purchase.id;
          fulfillment.invoice.productId = productId;
          await fulfillment.invoice.save({ transaction });
        }
      } else if (catalog.kind === 'joncoin') {
        const user = await User.findByPk(req.user.id, { transaction, lock: transaction.LOCK.UPDATE });
        if (!user) {
          const missingUser = new Error('Përdoruesi nuk u gjet');
          missingUser.code = 'IAP_USER_NOT_FOUND';
          throw missingUser;
        }
        const amount = Number(catalog.amount);
        user.joncoinBalance = round2(parseFloat(user.joncoinBalance || 0) + amount);
        await user.save({ transaction });
        joncoinTx = await JonCoinTransaction.create({
          userId: req.user.id,
          type: 'purchase',
          amount,
          status: 'completed',
          idempotencyKey: `iap:${transactionId}`,
          description: `IAP ${productId}`,
        }, { transaction });
        fulfillment = { joncoinBalance: user.joncoinBalance, transaction: joncoinTx };

        const { createInvoiceIfNeeded } = require('../utils/invoices');
        await createInvoiceIfNeeded({
          userId: req.user.id,
          kind: 'joncoin',
          source: 'iap',
          amount: Number(catalog.amount),
          currency: 'JC',
          description: `XCoin pack ${catalog.amount}`,
          productId,
          joncoinAmount: Number(catalog.amount),
          externalId: `iap:${transactionId}`,
          iapPurchaseId: purchase.id,
          joncoinTransactionId: joncoinTx.id,
          rawPayload: { platform, productId, transactionId },
          transaction,
        });
      }

      purchase.status = 'completed';
      await purchase.save({ transaction });
      return { purchase, fulfillment };
    });

    res.json({
      success: true,
      consumable: !!catalog.consumable,
      purchase: publicPurchase(result.purchase),
      fulfillment: result.fulfillment,
    });
  } catch (err) {
    if (err?.name === 'SequelizeUniqueConstraintError') {
      const existing = await IapPurchase.findOne({ where: { transactionId: String(req.body?.transactionId || req.body?.id || '') } });
      if (existing) return sendAlreadyProcessed(req, res, existing);
    }
    if (err?.code === 'IAP_USER_NOT_FOUND') return res.status(404).json({ msg: err.message });
    console.error('IAP verify error:', err);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

exports.PRODUCT_CATALOG = PRODUCT_CATALOG;
exports.validateAppleReceiptPayload = validateAppleReceiptPayload;
exports.verifyApplePurchase = verifyApplePurchase;
