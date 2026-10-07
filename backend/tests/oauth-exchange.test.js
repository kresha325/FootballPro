const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const {
  issueOAuthCode,
  consumeOAuthCode,
  oauthCallbackUrl,
} = require('../utils/oauthExchange');
const authRouter = require('../routes/auth');

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function postJson(port, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1',
      port,
      path: '/oauth/exchange',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
      });
    });
    req.on('error', reject);
    req.end(payload);
  });
}

describe('oauth one-time code', () => {
  it('puts only a code in the callback URL', () => {
    const web = oauthCallbackUrl({ mobile: false, frontendUrl: 'https://xtalenti.com', code: 'abc' });
    const mobile = oauthCallbackUrl({ mobile: true, frontendUrl: 'https://xtalenti.com', code: 'abc' });
    assert.equal(web, 'https://xtalenti.com/auth/callback?code=abc');
    assert.equal(mobile, 'xtalenti://auth/callback?code=abc');
    assert.equal(web.includes('token='), false);
    assert.equal(mobile.includes('token='), false);
  });

  it('exchanges a code once and rejects a second use or an expired code', async () => {
    const code = issueOAuthCode('jwt-one');
    assert.equal(consumeOAuthCode(code), 'jwt-one');
    assert.equal(consumeOAuthCode(code), null);

    const expired = issueOAuthCode('jwt-old', -1);
    assert.equal(consumeOAuthCode(expired), null);

    const live = issueOAuthCode('jwt-http');
    const app = express();
    app.use(express.json());
    app.use(authRouter);
    const server = await listen(app);
    try {
      const first = await postJson(server.address().port, { code: live });
      const second = await postJson(server.address().port, { code: live });
      assert.equal(first.status, 200);
      assert.equal(first.body.token, 'jwt-http');
      assert.equal(second.status, 400);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
