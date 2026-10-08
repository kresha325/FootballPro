const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  interpretProductPurchase,
  interpretSubscriptionPurchase,
  buildAssertionClaims,
  getServiceAccount,
  getPackageName,
} = require('../utils/googlePlay');

test('interpretProductPurchase accepts purchaseState 0 (purchased)', () => {
  const result = interpretProductPurchase({ purchaseState: 0 });
  assert.equal(result.ok, true);
});

test('interpretProductPurchase rejects purchaseState 1 (canceled)', () => {
  const result = interpretProductPurchase({ purchaseState: 1 });
  assert.equal(result.ok, false);
  assert.match(result.msg, /purchaseState=1/);
});

test('interpretProductPurchase rejects purchaseState 2 (pending)', () => {
  const result = interpretProductPurchase({ purchaseState: 2 });
  assert.equal(result.ok, false);
});

test('interpretProductPurchase rejects empty/undefined response', () => {
  assert.equal(interpretProductPurchase(null).ok, false);
  assert.equal(interpretProductPurchase(undefined).ok, false);
});

test('interpretSubscriptionPurchase accepts paymentState 1 (received) with future expiry', () => {
  const result = interpretSubscriptionPurchase({
    paymentState: 1,
    expiryTimeMillis: String(Date.now() + 86400000),
  });
  assert.equal(result.ok, true);
});

test('interpretSubscriptionPurchase accepts paymentState 2 (free trial)', () => {
  const result = interpretSubscriptionPurchase({
    paymentState: 2,
    expiryTimeMillis: String(Date.now() + 86400000),
  });
  assert.equal(result.ok, true);
});

test('interpretSubscriptionPurchase rejects paymentState 0 (pending)', () => {
  const result = interpretSubscriptionPurchase({ paymentState: 0 });
  assert.equal(result.ok, false);
  assert.match(result.msg, /paymentState=0/);
});

test('interpretSubscriptionPurchase rejects an expired subscription even with an accepted paymentState', () => {
  const result = interpretSubscriptionPurchase({
    paymentState: 1,
    expiryTimeMillis: String(Date.now() - 86400000),
  });
  assert.equal(result.ok, false);
  assert.match(result.msg, /skaduar/);
});

test('buildAssertionClaims produces RFC 7523 claims for the Google token endpoint', () => {
  const now = 1700000000;
  const claims = buildAssertionClaims({ client_email: 'svc@project.iam.gserviceaccount.com' }, now);
  assert.equal(claims.iss, 'svc@project.iam.gserviceaccount.com');
  assert.equal(claims.scope, 'https://www.googleapis.com/auth/androidpublisher');
  assert.equal(claims.aud, 'https://oauth2.googleapis.com/token');
  assert.equal(claims.iat, now);
  assert.equal(claims.exp, now + 3600);
});

test('getServiceAccount returns null when the env var is unset', () => {
  assert.equal(getServiceAccount({}), null);
});

test('getServiceAccount returns null for malformed JSON', () => {
  assert.equal(getServiceAccount({ GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: '{not json' }), null);
});

test('getServiceAccount returns null when required fields are missing', () => {
  assert.equal(
    getServiceAccount({ GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'a@b.com' }) }),
    null
  );
});

test('getServiceAccount parses a well-formed service account JSON', () => {
  const sa = getServiceAccount({
    GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify({
      client_email: 'svc@project.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
    }),
  });
  assert.equal(sa.client_email, 'svc@project.iam.gserviceaccount.com');
});

test('getPackageName defaults to the app bundle id when unset', () => {
  assert.equal(getPackageName({}), 'com.kresha325.xtalenti');
});

test('getPackageName honors an explicit override', () => {
  assert.equal(getPackageName({ GOOGLE_PLAY_PACKAGE_NAME: 'com.example.other' }), 'com.example.other');
});
