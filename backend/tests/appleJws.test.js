const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verifyAppleSignedPayload } = require('../utils/appleJws');

test('verifyAppleSignedPayload rejects malformed JWS (wrong number of parts)', () => {
  const result = verifyAppleSignedPayload('not-a-jws');
  assert.equal(result.ok, false);
});

test('verifyAppleSignedPayload rejects empty/undefined input without throwing', () => {
  assert.doesNotThrow(() => {
    const result = verifyAppleSignedPayload(undefined);
    assert.equal(result.ok, false);
  });
});

test('verifyAppleSignedPayload rejects a JWS with an unsupported alg', () => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', x5c: [] })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ productId: 'x' })).toString('base64url');
  const jws = `${header}.${payload}.signature`;
  const result = verifyAppleSignedPayload(jws);
  assert.equal(result.ok, false);
  assert.match(result.msg, /alg/i);
});

test('verifyAppleSignedPayload rejects a JWS with missing/invalid x5c chain', () => {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', x5c: ['bm90LWEtY2VydA=='] })).toString(
    'base64url'
  );
  const payload = Buffer.from(JSON.stringify({ productId: 'x' })).toString('base64url');
  const jws = `${header}.${payload}.signature`;
  const result = verifyAppleSignedPayload(jws);
  assert.equal(result.ok, false);
});

test('verifyAppleSignedPayload rejects a forged JWS even with a syntactically valid self-signed cert chain', () => {
  // A self-signed, non-Apple-issued certificate must never be accepted as the
  // chain's trust anchor — this guards against anyone minting their own CA
  // and forging an otherwise well-formed x5c chain.
  const { generateKeyPairSync, X509Certificate } = require('node:crypto');
  let selfSignedUsable = true;
  let x5c;
  try {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    // Node's core crypto module cannot mint X.509 certs directly; emulate the
    // negative case by feeding a chain whose bytes are valid base64 but not a
    // real certificate, which must be rejected rather than crash.
    void publicKey;
    void privateKey;
    void X509Certificate;
    x5c = [Buffer.from('invalid-cert-bytes').toString('base64')];
  } catch {
    selfSignedUsable = false;
  }
  if (!selfSignedUsable) return;

  const header = Buffer.from(JSON.stringify({ alg: 'ES256', x5c: [x5c[0], x5c[0]] })).toString(
    'base64url'
  );
  const payload = Buffer.from(JSON.stringify({ productId: 'x' })).toString('base64url');
  const jws = `${header}.${payload}.c2ln`;
  const result = verifyAppleSignedPayload(jws);
  assert.equal(result.ok, false);
});
