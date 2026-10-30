'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const sequelize = require('../config/database');
const IapPurchase = require('../models/IapPurchase');
const User = require('../models/User');
const { JonCoinTransaction } = require('../models');
const invoices = require('../utils/invoices');
const googlePlay = require('../utils/googlePlay');

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('Google verification persists the verified orderId instead of the client transactionId', async () => {
  const envKeys = ['NODE_ENV', 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON', 'IAP_ALLOW_UNVERIFIED'];
  const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  const originals = {
    transaction: sequelize.transaction,
    findPurchase: IapPurchase.findOne,
    createPurchase: IapPurchase.create,
    findUser: User.findByPk,
    createLedger: JonCoinTransaction.create,
    createInvoice: invoices.createInvoiceIfNeeded,
    verifyGoogle: googlePlay.verifyGooglePlayPurchase,
  };
  const controllerPath = require.resolve('../controllers/iap');
  const cachedController = require.cache[controllerPath];
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const requestedProduct = 'com.kresha325.xtalenti.joncoin.100';
  const stored = { lookup: null, purchase: null, ledger: null };

  process.env.NODE_ENV = 'test';
  process.env.IAP_ALLOW_UNVERIFIED = 'false';
  process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON = JSON.stringify({
    client_email: 'iap-test@example.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
  });
  googlePlay.verifyGooglePlayPurchase = async ({ productId, purchaseToken }) => {
    assert.equal(productId, requestedProduct);
    assert.equal(purchaseToken, 'google-token');
    return { ok: true, raw: { productId: requestedProduct, orderId: 'GPA.verified-order-123', purchaseState: 0 } };
  };
  delete require.cache[controllerPath];

  sequelize.transaction = async (callback) => callback(transaction);
  IapPurchase.findOne = async (options) => {
    stored.lookup = options.where.transactionId;
    return null;
  };
  IapPurchase.create = async (attributes, options) => {
    assert.equal(options.transaction, transaction);
    stored.purchase = attributes;
    return { id: 45, ...attributes, async save(saveOptions) { assert.equal(saveOptions.transaction, transaction); } };
  };
  const user = { id: 7, joncoinBalance: '5.00', async save(options) { assert.equal(options.transaction, transaction); } };
  User.findByPk = async (_id, options) => {
    assert.equal(options.transaction, transaction);
    return user;
  };
  JonCoinTransaction.create = async (attributes, options) => {
    assert.equal(options.transaction, transaction);
    stored.ledger = attributes;
    return { id: 56, ...attributes };
  };
  invoices.createInvoiceIfNeeded = async (attributes) => {
    assert.equal(attributes.transaction, transaction);
    return { created: true };
  };

  try {
    const { verifyAndFulfill } = require('../controllers/iap');
    const res = response();
    await verifyAndFulfill({
      user: { id: 7 },
      body: {
        platform: 'android',
        productId: requestedProduct,
        transactionId: 'client-controlled-transaction-id',
        purchaseToken: 'google-token',
      },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(stored.lookup, 'google:GPA.verified-order-123');
    assert.equal(stored.purchase.transactionId, 'google:GPA.verified-order-123');
    assert.equal(stored.ledger.idempotencyKey, 'iap:google:GPA.verified-order-123');
    assert.equal(stored.purchase.transactionId.includes('client-controlled'), false);
  } finally {
    if (cachedController) require.cache[controllerPath] = cachedController;
    else delete require.cache[controllerPath];
    sequelize.transaction = originals.transaction;
    IapPurchase.findOne = originals.findPurchase;
    IapPurchase.create = originals.createPurchase;
    User.findByPk = originals.findUser;
    JonCoinTransaction.create = originals.createLedger;
    invoices.createInvoiceIfNeeded = originals.createInvoice;
    googlePlay.verifyGooglePlayPurchase = originals.verifyGoogle;
    for (const key of envKeys) {
      if (previousEnv[key] === undefined) delete process.env[key];
      else process.env[key] = previousEnv[key];
    }
  }
});
