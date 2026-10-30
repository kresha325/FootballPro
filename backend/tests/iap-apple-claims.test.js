'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateAppleReceiptPayload } = require('../controllers/iap');

const productId = 'com.kresha325.xtalenti.joncoin.100';
const transactionId = 'apple-tx-123';

function receipt(overrides = {}) {
  return {
    status: 0,
    receipt: {
      bundle_id: 'com.kresha325.xtalenti',
      in_app: [{ product_id: productId, transaction_id: transactionId }],
    },
    ...overrides,
  };
}

test('Apple legacy receipt requires matching bundle, product, and transaction', () => {
  const valid = validateAppleReceiptPayload(receipt(), { productId, transactionId });
  assert.equal(valid.ok, true);

  assert.equal(validateAppleReceiptPayload(receipt({
    receipt: { bundle_id: 'com.other.app', in_app: [{ product_id: productId, transaction_id: transactionId }] },
  }), { productId, transactionId }).ok, false);

  assert.equal(validateAppleReceiptPayload(receipt(), { productId: 'com.other.product', transactionId }).ok, false);
  assert.equal(validateAppleReceiptPayload(receipt(), { productId, transactionId: 'different-tx' }).ok, false);
  assert.equal(validateAppleReceiptPayload({ status: 21010, receipt: {} }, { productId, transactionId }).ok, false);
});

test('Apple subscription receipt must be unexpired and not canceled', () => {
  const now = Date.now();
  const active = receipt({
    latest_receipt_info: [{
      product_id: productId,
      transaction_id: transactionId,
      expires_date_ms: String(now + 60_000),
    }],
  });
  assert.equal(validateAppleReceiptPayload(active, { productId, transactionId, isSubscription: true, now }).ok, true);

  const expired = receipt({
    latest_receipt_info: [{
      product_id: productId,
      transaction_id: transactionId,
      expires_date_ms: String(now - 60_000),
    }],
  });
  assert.equal(validateAppleReceiptPayload(expired, { productId, transactionId, isSubscription: true, now }).ok, false);

  const canceled = receipt({
    latest_receipt_info: [{
      product_id: productId,
      transaction_id: transactionId,
      expires_date_ms: String(now + 60_000),
      cancellation_date: new Date(now).toISOString(),
    }],
  });
  assert.equal(validateAppleReceiptPayload(canceled, { productId, transactionId, isSubscription: true, now }).ok, false);
});
