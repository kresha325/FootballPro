const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { verifyAppleSignedPayload } = require('../utils/appleJws');

// Builds a throwaway root -> intermediate -> leaf EC (P-256) certificate
// chain via the system `openssl` CLI, purely for testing the happy/negative
// paths of utils/appleJws.js. If openssl isn't available in this environment,
// the chain-dependent tests are skipped rather than failing the whole suite.
let fixtureDir = null;
let opensslAvailable = true;

function sh(cmd, args, cwd) {
  execFileSync(cmd, args, { cwd, stdio: 'ignore' });
}

before(() => {
  try {
    execFileSync('openssl', ['version'], { stdio: 'ignore' });
  } catch {
    opensslAvailable = false;
    return;
  }

  fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'applejws-golden-'));
  const dir = fixtureDir;

  sh('openssl', ['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', 'root.key'], dir);
  sh(
    'openssl',
    ['req', '-x509', '-new', '-key', 'root.key', '-days', '3650', '-out', 'root.pem', '-subj', '/CN=Test Root CA'],
    dir
  );

  sh('openssl', ['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', 'inter.key'], dir);
  sh(
    'openssl',
    ['req', '-new', '-key', 'inter.key', '-out', 'inter.csr', '-subj', '/CN=Test Intermediate CA'],
    dir
  );
  sh(
    'openssl',
    [
      'x509',
      '-req',
      '-in',
      'inter.csr',
      '-CA',
      'root.pem',
      '-CAkey',
      'root.key',
      '-CAcreateserial',
      '-days',
      '3650',
      '-out',
      'inter.pem',
    ],
    dir
  );

  sh('openssl', ['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', 'leaf.key'], dir);
  sh('openssl', ['req', '-new', '-key', 'leaf.key', '-out', 'leaf.csr', '-subj', '/CN=Test Leaf'], dir);
  sh(
    'openssl',
    [
      'x509',
      '-req',
      '-in',
      'leaf.csr',
      '-CA',
      'inter.pem',
      '-CAkey',
      'inter.key',
      '-CAcreateserial',
      '-days',
      '3650',
      '-out',
      'leaf.pem',
    ],
    dir
  );
});

after(() => {
  if (fixtureDir) {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

function pemToDerBase64(pemPath) {
  const pem = fs.readFileSync(pemPath, 'utf8');
  return new crypto.X509Certificate(pem).raw.toString('base64');
}

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildChainAndKey() {
  return {
    trustedRoot: new crypto.X509Certificate(fs.readFileSync(path.join(fixtureDir, 'root.pem'))),
    x5c: [pemToDerBase64(path.join(fixtureDir, 'leaf.pem')), pemToDerBase64(path.join(fixtureDir, 'inter.pem'))],
    leafKey: crypto.createPrivateKey(fs.readFileSync(path.join(fixtureDir, 'leaf.key'))),
  };
}

function signJws(header, payload, leafKey) {
  const headerB64 = base64url(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64url(Buffer.from(JSON.stringify(payload)));
  const signingInput = Buffer.from(`${headerB64}.${payloadB64}`);
  const signature = crypto.sign('sha256', signingInput, { key: leafKey, dsaEncoding: 'ieee-p1363' });
  return `${headerB64}.${payloadB64}.${base64url(signature)}`;
}

test('verifyAppleSignedPayload accepts a correctly signed JWS with a valid chain', (t) => {
  if (!opensslAvailable) return t.skip('openssl not available');
  const { trustedRoot, x5c, leafKey } = buildChainAndKey();
  const payload = {
    productId: 'com.kresha325.xtalenti.joncoin.100',
    transactionId: '123456789',
    bundleId: 'com.kresha325.xtalenti',
  };
  const jws = signJws({ alg: 'ES256', x5c }, payload, leafKey);

  const result = verifyAppleSignedPayload(jws, { trustedRoot });
  assert.equal(result.ok, true);
  assert.equal(result.payload.productId, payload.productId);
  assert.equal(result.payload.transactionId, payload.transactionId);
});

test('verifyAppleSignedPayload rejects a well-formed JWS whose chain is not Apple-trusted', (t) => {
  if (!opensslAvailable) return t.skip('openssl not available');
  // Same chain/signature as above, but verified WITHOUT the matching
  // trustedRoot override, so it must fall back to (and fail against) the
  // real embedded Apple Root CA.
  const { x5c, leafKey } = buildChainAndKey();
  const jws = signJws({ alg: 'ES256', x5c }, { productId: 'x', transactionId: '1' }, leafKey);

  const result = verifyAppleSignedPayload(jws); // no trustedRoot -> real Apple root
  assert.equal(result.ok, false);
});

test('verifyAppleSignedPayload rejects a tampered payload even with an otherwise valid signature', (t) => {
  if (!opensslAvailable) return t.skip('openssl not available');
  const { trustedRoot, x5c, leafKey } = buildChainAndKey();
  const original = { productId: 'com.kresha325.xtalenti.joncoin.100', transactionId: '1' };
  const jws = signJws({ alg: 'ES256', x5c }, original, leafKey);

  // Swap in a higher-value product after signing, keeping the original signature.
  const [headerB64, , signatureB64] = jws.split('.');
  const tamperedPayloadB64 = base64url(
    Buffer.from(JSON.stringify({ ...original, productId: 'com.kresha325.xtalenti.joncoin.1000' }))
  );
  const tamperedJws = `${headerB64}.${tamperedPayloadB64}.${signatureB64}`;

  const result = verifyAppleSignedPayload(tamperedJws, { trustedRoot });
  assert.equal(result.ok, false);
});
