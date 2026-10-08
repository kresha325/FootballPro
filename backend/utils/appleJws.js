const crypto = require('crypto');

/**
 * Apple Root CA - G3 (public, well-known trust anchor — safe to embed in source).
 * Downloaded from https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
 * SHA-256 fingerprint: 63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79
 */
const APPLE_ROOT_CA_G3_PEM = `-----BEGIN CERTIFICATE-----
MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwS
QXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9u
IEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcN
MTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBS
b290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9y
aXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49
AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtf
TjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517
IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySr
MA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gA
MGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4
at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM
6BgD56KyKA==
-----END CERTIFICATE-----`;

const APPLE_ROOT_CA = new crypto.X509Certificate(APPLE_ROOT_CA_G3_PEM);

function base64UrlToBuffer(segment) {
  const padded = String(segment || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, 'base64');
}

/**
 * Verifies the x5c certificate chain embedded in a JWS header terminates at
 * Apple's trusted root, that every certificate in the chain is currently
 * valid, and that each certificate was actually signed by the next one up.
 */
function verifyCertificateChain(x5c, trustedRoot) {
  if (!Array.isArray(x5c) || x5c.length < 2) {
    return { ok: false, msg: 'x5c mungon ose është jo i plotë' };
  }

  let certs;
  try {
    certs = x5c.map((b64) => new crypto.X509Certificate(Buffer.from(b64, 'base64')));
  } catch (e) {
    return { ok: false, msg: `Certifikatë e pavlefshme në x5c: ${e.message}` };
  }

  const now = new Date();
  for (const cert of certs) {
    if (now < new Date(cert.validFrom) || now > new Date(cert.validTo)) {
      return { ok: false, msg: `Certifikata ${cert.subject} ka skaduar ose s'është ende valide` };
    }
  }

  // Each certificate must be signed by the next one up the chain (leaf -> intermediate -> ...).
  for (let i = 0; i < certs.length - 1; i += 1) {
    if (!certs[i].verify(certs[i + 1].publicKey)) {
      return { ok: false, msg: 'Zinxhiri i certifikatave x5c nuk përputhet (nënshkrim i pavlefshëm)' };
    }
  }

  // The top-most certificate in the chain must itself be signed by the trusted root.
  const topMost = certs[certs.length - 1];
  if (!topMost.verify((trustedRoot || APPLE_ROOT_CA).publicKey)) {
    return { ok: false, msg: 'Zinxhiri i certifikatave nuk përfundon te Apple Root CA' };
  }

  return { ok: true, leaf: certs[0] };
}

/**
 * Verifies a StoreKit 2 signed JWS (signedTransactionInfo / signedPayload /
 * purchaseToken) end-to-end: decodes+validates the x5c certificate chain
 * against Apple's Root CA, then verifies the ES256 signature over the JWS
 * using the leaf certificate's public key. Returns the decoded payload only
 * if the whole chain checks out — callers must not trust the payload
 * otherwise, since anyone can craft an arbitrary unsigned/self-signed JWS.
 */
function verifyAppleSignedPayload(jws, options = {}) {
  const parts = String(jws || '').split('.');
  if (parts.length !== 3) {
    return { ok: false, msg: 'JWS i pavlefshëm (duhen 3 pjesë)' };
  }
  const [headerB64, payloadB64, signatureB64] = parts;

  let header;
  try {
    header = JSON.parse(base64UrlToBuffer(headerB64).toString('utf8'));
  } catch {
    return { ok: false, msg: 'Header JWS i pavlefshëm' };
  }

  if (header.alg !== 'ES256') {
    return { ok: false, msg: `Algoritëm JWS i papritur: ${header.alg}` };
  }

  const chainResult = verifyCertificateChain(header.x5c, options.trustedRoot);
  if (!chainResult.ok) {
    return chainResult;
  }

  const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, 'utf8');
  const signature = base64UrlToBuffer(signatureB64);
  let signatureValid = false;
  try {
    signatureValid = crypto.verify(
      'sha256',
      signingInput,
      { key: chainResult.leaf.publicKey, dsaEncoding: 'ieee-p1363' },
      signature
    );
  } catch (e) {
    return { ok: false, msg: `Verifikimi i nënshkrimit dështoi: ${e.message}` };
  }

  if (!signatureValid) {
    return { ok: false, msg: 'Nënshkrimi JWS është i pavlefshëm' };
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlToBuffer(payloadB64).toString('utf8'));
  } catch {
    return { ok: false, msg: 'Payload JWS i pavlefshëm' };
  }

  return { ok: true, payload };
}

module.exports = { verifyAppleSignedPayload };
