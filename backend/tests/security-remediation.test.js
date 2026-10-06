/**
 * Security remediation checks that do not need a database.
 * Run: node --test tests/security-remediation.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const jwt = require('jsonwebtoken');

const { isAllowedOrigin, buildAllowedOrigins } = require('../utils/corsPolicy');
const { safeExtension, storedFilename, signatureOk, MEDIA_EXTS, BLOCKED_EXT } = require('../utils/uploadNames');
const { unverifiedIapAllowed } = require('../utils/iapPolicy');
const { sanitizeErrorBody } = require('../utils/errorSanitize');
const { toPublicUser, ASSIGNABLE_ROLES } = require('../utils/publicUser');
const { viewerCanSeeVideo } = require('../utils/videoAccess');
const { ALLOWED_REGISTER_ROLES } = require('../utils/registerValidation');
const { assertDestructiveAllowed } = require('../utils/destructiveGuard');

describe('unauthenticated and admin authorization', () => {
  it('rejects an admin route without a token', async () => {
    const admin = require('../middleware/admin');
    const res = {
      code: null,
      body: null,
      status(code) { this.code = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await admin({ header: () => undefined }, res, () => {
      throw new Error('next should not run');
    });
    assert.equal(res.code, 401);
  });

  it('rejects a normal user on an admin route', async () => {
    process.env.JWT_SECRET = 'security-remediation-secret';
    process.env.NODE_ENV = 'test';
    const userPath = require.resolve('../models/User');
    const jwtPath = require.resolve('../utils/jwtSecret');
    delete require.cache[jwtPath];
    require.cache[userPath] = {
      id: userPath,
      filename: userPath,
      loaded: true,
      exports: {
        findByPk: async () => ({
          id: 7,
          role: 'athlete',
          email: 'athlete@example.com',
          deletedAt: null,
          bannedAt: null,
          premium: false,
          premiumExpiresAt: null,
          subscriptionPlan: 'free',
          verified: false,
          createdAt: new Date(),
          get() {
            return {
              id: 7,
              role: 'athlete',
              email: 'athlete@example.com',
              premium: false,
              premiumExpiresAt: null,
              subscriptionPlan: 'free',
              verified: false,
              createdAt: new Date(),
            };
          },
        }),
      },
    };
    delete require.cache[require.resolve('../middleware/auth')];
    delete require.cache[require.resolve('../middleware/admin')];
    const admin = require('../middleware/admin');
    const token = jwt.sign({ user: { id: 7 } }, 'security-remediation-secret', { expiresIn: '5m' });
    const res = {
      code: null,
      status(code) { this.code = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await admin({ header: () => `Bearer ${token}` }, res, () => {
      throw new Error('next should not run');
    });
    assert.equal(res.code, 403);
  });
});

describe('JWT expiration and banned users', () => {
  it('rejects an expired token', async () => {
    process.env.JWT_SECRET = 'security-remediation-secret';
    process.env.NODE_ENV = 'test';
    delete require.cache[require.resolve('../utils/jwtSecret')];
    delete require.cache[require.resolve('../middleware/auth')];
    const auth = require('../middleware/auth');
    const token = jwt.sign({ user: { id: 1 } }, 'security-remediation-secret', { expiresIn: -10 });
    const res = {
      code: null,
      status(code) { this.code = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await auth({ header: () => `Bearer ${token}` }, res, () => {
      throw new Error('next should not run');
    });
    assert.equal(res.code, 401);
  });

  it('rejects a banned user', async () => {
    process.env.JWT_SECRET = 'security-remediation-secret';
    process.env.NODE_ENV = 'test';
    const userPath = require.resolve('../models/User');
    require.cache[userPath] = {
      id: userPath,
      filename: userPath,
      loaded: true,
      exports: {
        findByPk: async () => ({
          id: 3,
          role: 'athlete',
          deletedAt: null,
          bannedAt: new Date(),
        }),
      },
    };
    delete require.cache[require.resolve('../utils/jwtSecret')];
    delete require.cache[require.resolve('../middleware/auth')];
    const auth = require('../middleware/auth');
    const token = jwt.sign({ user: { id: 3 } }, 'security-remediation-secret', { expiresIn: '5m' });
    const res = {
      code: null,
      status(code) { this.code = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await auth({ header: () => `Bearer ${token}` }, res, () => {
      throw new Error('next should not run');
    });
    assert.equal(res.code, 403);
  });
});

describe('role escalation and mass assignment', () => {
  it('does not allow self-registration as admin', () => {
    assert.equal(ALLOWED_REGISTER_ROLES.includes('admin'), false);
    assert.equal(ALLOWED_REGISTER_ROLES.includes('liga'), false);
  });

  it('strips password and reset tokens from user responses', () => {
    const pub = toPublicUser({
      id: 1,
      role: 'athlete',
      password: 'hashed',
      resetPasswordToken: 'token',
      resetPasswordExpire: new Date(),
      email: 'a@example.com',
    });
    assert.equal(pub.password, undefined);
    assert.equal(pub.resetPasswordToken, undefined);
    assert.equal(pub.email, 'a@example.com');
    assert.ok(ASSIGNABLE_ROLES.includes('athlete'));
    assert.equal(ASSIGNABLE_ROLES.includes('not-a-role'), false);
  });
});

describe('IDOR video visibility', () => {
  const video = { userId: 2, visibility: 'private' };

  it('hides a private video from another user', () => {
    assert.equal(viewerCanSeeVideo(video, { id: 1, role: 'athlete' }), false);
    assert.equal(viewerCanSeeVideo(video, null), false);
  });

  it('allows the owner and an admin', () => {
    assert.equal(viewerCanSeeVideo(video, { id: 2, role: 'athlete' }), true);
    assert.equal(viewerCanSeeVideo(video, { id: 9, role: 'admin' }), true);
  });
});

describe('wallet, order, and payment manipulation guards', () => {
  it('does not accept unverified store purchases in production', () => {
    assert.equal(unverifiedIapAllowed({ NODE_ENV: 'production', IAP_ALLOW_UNVERIFIED: 'true' }), false);
    assert.equal(unverifiedIapAllowed({ NODE_ENV: 'development', IAP_ALLOW_UNVERIFIED: 'true' }), true);
    assert.equal(unverifiedIapAllowed({ NODE_ENV: 'development', IAP_ALLOW_UNVERIFIED: 'false' }), false);
  });

  it('keeps client payment status off the created payment row', async () => {
    const paymentPath = require.resolve('../models/Payment');
    let created = null;
    require.cache[paymentPath] = {
      id: paymentPath,
      filename: paymentPath,
      loaded: true,
      exports: {
        create: async (row) => {
          created = row;
          return row;
        },
      },
    };
    delete require.cache[require.resolve('../controllers/payments')];
    const { createPayment } = require('../controllers/payments');
    const res = {
      code: null,
      status(code) { this.code = code; return this; },
      json() { return this; },
    };
    await createPayment({
      user: { id: 5 },
      body: { amount: 12, status: 'completed', userId: 99, sellerId: 4 },
    }, res);
    assert.equal(created.userId, 5);
    assert.equal(created.status, 'pending');
    assert.equal(created.sellerId, undefined);
    assert.equal(Object.prototype.hasOwnProperty.call(created, 'status') && created.status !== 'completed', true);
  });
});

describe('upload restrictions', () => {
  it('rejects path traversal, executables, and svg names', () => {
    assert.equal(safeExtension('../etc/passwd.php', MEDIA_EXTS), null);
    assert.equal(safeExtension('photo.svg', MEDIA_EXTS), null);
    assert.equal(safeExtension('evil.php', MEDIA_EXTS), null);
    assert.equal(safeExtension('shell.php.jpg', MEDIA_EXTS), '.jpg');
    assert.equal(BLOCKED_EXT.has('.html'), true);
    const name = storedFilename({ originalname: 'avatar.png', mimetype: 'image/png' }, MEDIA_EXTS);
    assert.match(name, /^\d+-\d+\.png$/);
    assert.equal(name.includes('avatar'), false);
  });

  it('rejects an executable payload even with an image extension', () => {
    assert.equal(signatureOk('.png', Buffer.from([0x4d, 0x5a, 0x90, 0x00])), false);
    assert.equal(signatureOk('.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])), true);
  });
});

describe('CORS', () => {
  const prod = { NODE_ENV: 'production', CORS_ORIGIN: 'https://xtalenti.com', FRONTEND_URL: 'https://xtalenti.com' };

  it('allows the production site and mobile clients without an Origin', () => {
    const allowed = buildAllowedOrigins(prod);
    assert.equal(isAllowedOrigin('https://xtalenti.com', prod, allowed), true);
    assert.equal(isAllowedOrigin(undefined, prod, allowed), true);
  });

  it('rejects localhost and wildcard origins in production', () => {
    const allowed = buildAllowedOrigins({ ...prod, CORS_ORIGIN: '*' });
    assert.equal(allowed.includes('*'), false);
    assert.equal(isAllowedOrigin('http://localhost:5173', prod, allowed), false);
    assert.equal(isAllowedOrigin('https://evil.example', prod, allowed), false);
  });
});

describe('error and destructive-script guards', () => {
  it('strips SQL and stack details from production 500 responses', () => {
    const body = sanitizeErrorBody(
      { msg: 'select * from Users', error: 'password=secret', details: { sql: 'SELECT 1' }, stack: 'Error' },
      500,
      { NODE_ENV: 'production' }
    );
    assert.equal(body.stack, undefined);
    assert.equal(body.details, undefined);
    assert.equal(body.error, undefined);
    assert.equal(body.msg, 'Server error');
  });

  it('refuses destructive scripts in production', () => {
    const previousExit = process.exit;
    const previousEnv = process.env.NODE_ENV;
    const previousAllow = process.env.ALLOW_DESTRUCTIVE;
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_DESTRUCTIVE;
    process.exit = (code) => {
      throw new Error(`exit ${code}`);
    };
    try {
      assert.throws(() => assertDestructiveAllowed('unit'), /exit 1/);
    } finally {
      process.exit = previousExit;
      process.env.NODE_ENV = previousEnv;
      if (previousAllow === undefined) delete process.env.ALLOW_DESTRUCTIVE;
      else process.env.ALLOW_DESTRUCTIVE = previousAllow;
    }
  });
});

describe('local upload bytes', () => {
  it('writes only an allowlisted extension', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-upload-'));
    const file = path.join(dir, '1700.png');
    fs.writeFileSync(file, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const { assertLocalUpload } = require('../utils/uploadNames');
    const ok = assertLocalUpload({ path: file, filename: '1700.png' });
    assert.equal(ok.ok, true);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
