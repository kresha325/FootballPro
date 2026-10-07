const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { passwordPolicyMessage, TOO_SHORT, TOO_COMMON } = require('../utils/passwordPolicy');
const { register, resetPassword } = require('../controllers/auth');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

describe('password policy', () => {
  it('rejects fewer than 10 characters and exact common passwords', () => {
    assert.equal(passwordPolicyMessage('short'), TOO_SHORT);
    assert.equal(passwordPolicyMessage('123456789'), TOO_SHORT);
    assert.equal(passwordPolicyMessage('password123'), TOO_COMMON);
    assert.equal(passwordPolicyMessage('Password123'), TOO_COMMON);
    assert.equal(passwordPolicyMessage('Korra-nates-2026'), null);
  });

  it('rejects a short password on register before any database write', async () => {
    const res = mockRes();
    await register({
      body: {
        email: 'policy@example.com',
        password: 'short',
        firstName: 'Ana',
        lastName: 'Hoxha',
        role: 'athlete',
      },
    }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.msg, TOO_SHORT);
  });

  it('rejects a common password on reset before looking up the token', async () => {
    const res = mockRes();
    await resetPassword({ body: { token: 'unused', password: 'football123' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.msg, TOO_COMMON);
  });
});
