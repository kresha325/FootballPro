/**
 * Login limiter and trust-proxy hop count.
 * Run: node --test tests/rate-limit-proxy.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const { authWriteLimiter } = require('../routes/auth');

const CLIENT = '203.0.113.10';

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function post(port, xForwardedFor) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port,
      path: '/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': xForwardedFor,
      },
    }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end('{}');
  });
}

describe('login rate limit behind one proxy', () => {
  it('returns 429 after 20 attempts and ignores extra X-Forwarded-For hops', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.post('/login', authWriteLimiter, (_req, res) => res.json({ ok: true }));
    const server = await listen(app);
    const port = server.address().port;
    try {
      for (let i = 0; i < 20; i += 1) {
        const status = await post(port, CLIENT);
        assert.equal(status, 200, `attempt ${i + 1} should pass`);
      }
      assert.equal(await post(port, CLIENT), 429);
      assert.equal(await post(port, `198.51.100.9, ${CLIENT}`), 429);
      assert.equal(await post(port, `::ffff:198.51.100.9, ${CLIENT}`), 429);
      assert.equal(await post(port, '203.0.113.11'), 200);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
