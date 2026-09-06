const https = require('https');
const IapPurchase = require('../models/IapPurchase');
const User = require('../models/User');
const { JonCoinTransaction } = require('../models');
const { activatePremiumForUser, PLANS } = require('./premium');

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
  return (
    String(process.env.IAP_ALLOW_UNVERIFIED || '').toLowerCase() === 'true' ||
    process.env.IAP_ALLOW_UNVERIFIED === '1'
  );
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

/** StoreKit 2 often sends JWS in purchaseToken — decode payload (sig verify TODO via App Store Server API). */
function decodeAppleJwsPayload(jws) {
  try {
    const parts = String(jws || '').split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(b64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function verifyApplePurchase({ transactionReceipt, purchaseToken, productId, transactionId }) {
  const legacyReceipt =
    transactionReceipt ||
    (purchaseToken && !String(purchaseToken).includes('.') ? purchaseToken : null);

  if (legacyReceipt) {
    return verifyAppleReceipt(legacyReceipt);
  }

  if (purchaseToken && String(purchaseToken).includes('.')) {
    const payload = decodeAppleJwsPayload(purchaseToken);
    const jwsProduct =
      payload?.productId || payload?.product_id || payload?.bundleId || null;
    const jwsTx =
      payload?.transactionId ||
      payload?.originalTransactionId ||
      payload?.transaction_id ||
      null;
    const productOk = !jwsProduct || jwsProduct === productId;
    const txOk = !transactionId || !jwsTx || String(jwsTx) === String(transactionId);
    if (payload && productOk && txOk) {
      // Production should verify JWS signature / App Store Server API; allow gated soft-accept.
      if (process.env.NODE_ENV === 'production' && !allowUnverifiedIap() && !process.env.APPLE_IAP_SHARED_SECRET) {
        return {
          ok: false,
          msg: 'Apple JWS: vendos APPLE_IAP_SHARED_SECRET ose App Store Server API; për staging IAP_ALLOW_UNVERIFIED=true',
        };
      }
      return { ok: true, jws: true, payload };
    }
  }

  if (allowUnverifiedIap() && process.env.NODE_ENV !== 'production') {
    return { ok: true, unverified: true };
  }
  return { ok: false, msg: 'Nuk u gjet receipt/JWS i vlefshëm për Apple' };
}

/**
 * Google Play verification via Android Publisher API requires a service account.
 * When unset in non-production, allow with IAP_ALLOW_UNVERIFIED=true for sandbox wiring.
 */
async function verifyGooglePurchase({ productId, purchaseToken }) {
  if (!purchaseToken || !productId) {
    return { ok: false, msg: 'purchaseToken / productId mungojnë' };
  }

  if (!process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON) {
    if (allowUnverifiedIap() && process.env.NODE_ENV !== 'production') {
      return { ok: true, unverified: true };
    }
    return {
      ok: false,
      msg: 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON mungon — vendos service account ose IAP_ALLOW_UNVERIFIED për dev',
    };
  }

  // Full Google API verify can be wired with googleapis; token presence + staging flag for now.
  if (allowUnverifiedIap()) {
    return { ok: true, unverified: true, note: 'Token present; wire Play Developer API for production' };
  }
  return {
    ok: false,
    msg: 'Google Play receipt verification not fully configured — set IAP_ALLOW_UNVERIFIED for staging or wire Play Developer API',
  };
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
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
      return res.json({
        success: true,
        alreadyProcessed: true,
        purchase: existing,
        msg: 'Blerja ishte tashmë e përpunuar',
      });
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
      });
      if (!verified.ok) {
        return res.status(400).json({ msg: verified.msg || 'Verifikimi Apple dështoi' });
      }
    } else {
      const verified = await verifyGooglePurchase({
        productId,
        purchaseToken,
      });
      if (!verified.ok) {
        return res.status(400).json({ msg: verified.msg || 'Verifikimi Google dështoi' });
      }
    }

    let fulfillment = null;
    if (catalog.kind === 'premium') {
      fulfillment = await activatePremiumForUser(req.user.id, catalog.plan, `iap:${transactionId}`);
      if (!fulfillment) return res.status(404).json({ msg: 'Përdoruesi nuk u gjet' });
    } else if (catalog.kind === 'joncoin') {
      const user = await User.findByPk(req.user.id);
      if (!user) return res.status(404).json({ msg: 'Përdoruesi nuk u gjet' });
      const amount = Number(catalog.amount);
      user.joncoinBalance = round2(parseFloat(user.joncoinBalance || 0) + amount);
      await user.save();
      const tx = await JonCoinTransaction.create({
        userId: req.user.id,
        type: 'purchase',
        amount,
        status: 'completed',
        description: `IAP ${productId}`,
      });
      fulfillment = { joncoinBalance: user.joncoinBalance, transaction: tx };
    }

    const purchase = await IapPurchase.create({
      userId: req.user.id,
      platform,
      productId,
      transactionId,
      purchaseToken,
      kind: catalog.kind,
      status: 'completed',
      rawPayload: {
        productId,
        transactionId,
        hasReceipt: !!transactionReceipt,
      },
    });

    res.json({
      success: true,
      consumable: !!catalog.consumable,
      purchase,
      fulfillment,
    });
  } catch (err) {
    console.error('IAP verify error:', err);
    if (err?.name === 'SequelizeUniqueConstraintError') {
      return res.json({ success: true, alreadyProcessed: true });
    }
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

exports.PRODUCT_CATALOG = PRODUCT_CATALOG;
