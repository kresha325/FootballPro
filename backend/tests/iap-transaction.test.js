'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const sequelize = require('../config/database');
const IapPurchase = require('../models/IapPurchase');
const User = require('../models/User');
const Payment = require('../models/Payment');
const { JonCoinTransaction } = require('../models');
const invoices = require('../utils/invoices');
const { verifyAndFulfill } = require('../controllers/iap');

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function request(userId = 7) {
  return {
    user: { id: userId },
    body: {
      platform: 'android',
      productId: 'com.kresha325.xtalenti.joncoin.100',
      transactionId: 'store-tx-100',
      purchaseToken: 'opaque-store-token',
    },
  };
}

describe('IAP transaction claiming and fulfillment', () => {
  const originals = {
    env: {
      NODE_ENV: process.env.NODE_ENV,
      IAP_ALLOW_UNVERIFIED: process.env.IAP_ALLOW_UNVERIFIED,
    },
    transaction: sequelize.transaction,
    findPurchase: IapPurchase.findOne,
    createPurchase: IapPurchase.create,
    findUser: User.findByPk,
    createLedger: JonCoinTransaction.create,
    findPayment: Payment.findOne,
    createPayment: Payment.create,
    createInvoice: invoices.createInvoiceIfNeeded,
  };

  it('claims the unique transaction and commits XCoin, ledger, invoice, and purchase together', async () => {
    process.env.NODE_ENV = 'test';
    process.env.IAP_ALLOW_UNVERIFIED = 'true';
    const transaction = { LOCK: { UPDATE: 'UPDATE' } };
    const created = { purchases: [], ledger: [], invoices: [], transactionSeen: [] };
    sequelize.transaction = async (callback) => callback(transaction);
    IapPurchase.findOne = async () => null;
    IapPurchase.create = async (attributes, options) => {
      assert.equal(options.transaction, transaction);
      const row = {
        id: 15,
        ...attributes,
        async save(saveOptions) {
          assert.equal(saveOptions.transaction, transaction);
          created.transactionSeen.push(saveOptions.transaction);
        },
      };
      created.purchases.push(row);
      return row;
    };
    const user = {
      id: 7,
      joncoinBalance: '25.00',
      async save(options) {
        assert.equal(options.transaction, transaction);
        created.transactionSeen.push(options.transaction);
      },
    };
    User.findByPk = async (_id, options) => {
      assert.equal(options.transaction, transaction);
      assert.equal(options.lock, transaction.LOCK.UPDATE);
      return user;
    };
    JonCoinTransaction.create = async (attributes, options) => {
      assert.equal(options.transaction, transaction);
      const row = { id: 22, ...attributes };
      created.ledger.push(row);
      return row;
    };
    invoices.createInvoiceIfNeeded = async (attributes) => {
      assert.equal(attributes.transaction, transaction);
      created.invoices.push(attributes);
      return { created: true };
    };

    try {
      const res = response();
      await verifyAndFulfill(request(), res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(user.joncoinBalance, 125);
      assert.equal(created.purchases[0].status, 'completed');
      assert.equal(created.ledger.length, 1);
      assert.equal(created.ledger[0].idempotencyKey, 'iap:store-tx-100');
      assert.equal(created.invoices.length, 1);
      assert.ok(created.transactionSeen.every((seen) => seen === transaction));
      assert.equal(res.body.purchase.purchaseToken, undefined);
      assert.equal(res.body.purchase.rawPayload, undefined);
    } finally {
      sequelize.transaction = originals.transaction;
      IapPurchase.findOne = originals.findPurchase;
      IapPurchase.create = originals.createPurchase;
      User.findByPk = originals.findUser;
      JonCoinTransaction.create = originals.createLedger;
      invoices.createInvoiceIfNeeded = originals.createInvoice;
      if (originals.env.NODE_ENV === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originals.env.NODE_ENV;
      if (originals.env.IAP_ALLOW_UNVERIFIED === undefined) delete process.env.IAP_ALLOW_UNVERIFIED;
      else process.env.IAP_ALLOW_UNVERIFIED = originals.env.IAP_ALLOW_UNVERIFIED;
    }
  });

  it('passes the same database transaction through Premium, payment, and invoice writes', async () => {
    const premiumPath = require.resolve('../controllers/premium');
    const cachedPremium = require.cache[premiumPath];
    const transaction = { LOCK: { UPDATE: 'UPDATE' } };
    const seen = [];
    const user = {
      id: 7,
      role: 'coach',
      premium: false,
      premiumExpiresAt: null,
      subscriptionPlan: 'free',
      async save(options) { seen.push(options.transaction); },
    };
    User.findByPk = async (_id, options) => {
      seen.push(options.transaction);
      assert.equal(options.lock, transaction.LOCK.UPDATE);
      return user;
    };
    Payment.findOne = async (options) => {
      seen.push(options.transaction);
      return null;
    };
    Payment.create = async (_attributes, options) => {
      seen.push(options.transaction);
      return { id: 33 };
    };
    invoices.createInvoiceIfNeeded = async (attributes) => {
      seen.push(attributes.transaction);
      return { invoice: { async save(options) { seen.push(options.transaction); } } };
    };
    delete require.cache[premiumPath];
    try {
      const { activatePremiumForUser } = require('../controllers/premium');
      const result = await activatePremiumForUser(7, 'monthly', 'iap:premium-tx', {
        source: 'iap',
        productId: 'com.kresha325.xtalenti.premium.monthly',
        iapPurchaseId: 20,
        transaction,
      });
      assert.equal(result.premium, true);
      assert.ok(seen.length >= 5);
      assert.ok(seen.every((seenTransaction) => seenTransaction === transaction));
    } finally {
      if (cachedPremium) require.cache[premiumPath] = cachedPremium;
      else delete require.cache[premiumPath];
      User.findByPk = originals.findUser;
      Payment.findOne = originals.findPayment;
      Payment.create = originals.createPayment;
      invoices.createInvoiceIfNeeded = originals.createInvoice;
    }
  });

  it('does not disclose or accept a transaction already owned by another account', async () => {
    IapPurchase.findOne = async () => ({
      id: 99,
      userId: 88,
      platform: 'android',
      productId: 'com.kresha325.xtalenti.joncoin.100',
      transactionId: 'store-tx-100',
      status: 'completed',
      purchaseToken: 'do-not-leak',
    });
    try {
      const res = response();
      await verifyAndFulfill(request(7), res);
      assert.equal(res.statusCode, 409);
      assert.equal(JSON.stringify(res.body).includes('do-not-leak'), false);
      assert.equal(JSON.stringify(res.body).includes('88'), false);
    } finally {
      IapPurchase.findOne = originals.findPurchase;
    }
  });

  it('returns idempotent success only for the same completed owner/product/platform', async () => {
    IapPurchase.findOne = async () => ({
      id: 16,
      userId: 7,
      platform: 'android',
      productId: 'com.kresha325.xtalenti.joncoin.100',
      transactionId: 'store-tx-100',
      kind: 'joncoin',
      status: 'completed',
      purchaseToken: 'do-not-leak',
      rawPayload: { private: true },
    });
    let transactionStarted = false;
    sequelize.transaction = async () => { transactionStarted = true; };
    try {
      const res = response();
      await verifyAndFulfill(request(), res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.alreadyProcessed, true);
      assert.equal(transactionStarted, false);
      assert.equal(res.body.purchase.purchaseToken, undefined);
      assert.equal(res.body.purchase.rawPayload, undefined);
    } finally {
      IapPurchase.findOne = originals.findPurchase;
      sequelize.transaction = originals.transaction;
    }
  });

  it('resolves a concurrent unique transaction claim to the existing owner record', async () => {
    process.env.NODE_ENV = 'test';
    process.env.IAP_ALLOW_UNVERIFIED = 'true';
    let reads = 0;
    IapPurchase.findOne = async () => {
      reads += 1;
      return reads === 1 ? null : {
        id: 17,
        userId: 7,
        platform: 'android',
        productId: 'com.kresha325.xtalenti.joncoin.100',
        transactionId: 'store-tx-100',
        kind: 'joncoin',
        status: 'completed',
      };
    };
    IapPurchase.create = async () => {
      const error = new Error('duplicate transaction id');
      error.name = 'SequelizeUniqueConstraintError';
      throw error;
    };
    sequelize.transaction = async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } });
    try {
      const res = response();
      await verifyAndFulfill(request(), res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.alreadyProcessed, true);
      assert.equal(reads, 2);
    } finally {
      IapPurchase.findOne = originals.findPurchase;
      IapPurchase.create = originals.createPurchase;
      sequelize.transaction = originals.transaction;
      if (originals.env.NODE_ENV === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originals.env.NODE_ENV;
      if (originals.env.IAP_ALLOW_UNVERIFIED === undefined) delete process.env.IAP_ALLOW_UNVERIFIED;
      else process.env.IAP_ALLOW_UNVERIFIED = originals.env.IAP_ALLOW_UNVERIFIED;
    }
  });
});
