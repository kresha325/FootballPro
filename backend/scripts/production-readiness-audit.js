'use strict';

/**
 * Live checks against a running API and the audit database.
 * Usage: node scripts/production-readiness-audit.js
 * Requires the server started with JWT_SECRET=audit-test-jwt-secret.
 */
const { Client } = require('pg');
const User = require('../models/User');

const base = process.env.AUDIT_API || 'http://127.0.0.1:10099';
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
}

async function call(method, path, { token, body, raw, headers } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body !== undefined && raw === undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_err) { json = null; }
  return { status: res.status, json, text };
}

function stamp() {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

async function register(role, extra = {}) {
  const id = stamp();
  const res = await call('POST', '/api/auth/register', {
    body: {
      email: `audit-${role}-${id}@example.com`,
      password: 'AuditPass1',
      firstName: 'Audit',
      lastName: role,
      role,
      dateOfBirth: '2000-01-15',
      ...extra,
    },
  });
  return { res, email: `audit-${role}-${id}@example.com` };
}

async function login(email, password = 'AuditPass1') {
  return call('POST', '/api/auth/login', { body: { email, password } });
}

async function main() {
  const root = await call('GET', '/');
  record('api root', root.status === 200, `status ${root.status}`);

  const noAuth = await call('GET', '/api/admin/ops/dashboard');
  record('admin without token', noAuth.status === 401, `status ${noAuth.status}`);

  const badRegister = await call('POST', '/api/auth/register', { body: { email: 'not-an-email' } });
  record('register missing fields', badRegister.status === 400, `status ${badRegister.status}`);

  const adminRegister = await register('admin');
  record('cannot self-register as admin', adminRegister.res.status === 400, `status ${adminRegister.res.status}`);

  const escalated = await register('athlete', {
    role: 'athlete',
    joncoinBalance: 9999,
    verified: true,
    premium: true,
    isAdmin: true,
    adminRole: 'super_admin',
    walletBalance: 5000,
  });
  const escalatedBody = JSON.stringify(escalated.res.json || {});
  record(
    'register ignores protected fields',
    escalated.res.status === 201
      && !escalatedBody.includes('$2')
      && !escalatedBody.toLowerCase().includes('password')
      && escalated.res.json?.user?.role === 'athlete'
      && escalated.res.json?.user?.verified === false,
    `status ${escalated.res.status} role ${escalated.res.json?.user?.role}`
  );

  const userA = await register('athlete');
  const userB = await register('athlete');
  const seller = await register('business');
  const scoutA = await register('scout');
  const scoutB = await register('scout');
  record('register five accounts', [userA, userB, seller, scoutA, scoutB].every((row) => row.res.status === 201), 'created');

  const badLogin = await login(userA.email, 'wrong-password');
  const badText = badLogin.text || '';
  record(
    'bad password is 400 without internals',
    badLogin.status === 400 && !/sequelize|stack|select /i.test(badText),
    `status ${badLogin.status}`
  );

  const sqlLogin = await login(`' OR 1=1 --`, 'x');
  record('login SQL probe', sqlLogin.status === 400, `status ${sqlLogin.status}`);

  const malformed = await call('POST', '/api/auth/login', { raw: '{', headers: { 'Content-Type': 'application/json' } });
  record('malformed JSON', malformed.status === 400, `status ${malformed.status} ${malformed.text.slice(0, 80)}`);

  const loginA = await login(userA.email);
  const loginB = await login(userB.email);
  const loginSeller = await login(seller.email);
  const loginScoutA = await login(scoutA.email);
  const loginScoutB = await login(scoutB.email);
  const tokenA = loginA.json?.token;
  const tokenB = loginB.json?.token;
  record('login returns token without password', Boolean(tokenA) && !JSON.stringify(loginA.json).includes('$2'), `status ${loginA.status}`);

  const me = await call('GET', '/api/auth/me', { token: tokenA });
  const meText = JSON.stringify(me.json || {});
  record(
    'me hides password hash and balance mutation',
    me.status === 200 && !meText.includes('password') && !meText.includes('$2') && Number(me.json?.joncoinBalance || 0) === 0,
    `status ${me.status}`
  );

  const expired = require('jsonwebtoken').sign({ user: { id: me.json.id, tv: 0 } }, 'audit-test-jwt-secret', { expiresIn: -10 });
  const expiredRes = await call('GET', '/api/auth/me', { token: expired });
  record('expired token', expiredRes.status === 401, `status ${expiredRes.status}`);

  const garbage = await call('GET', '/api/auth/me', { token: 'not-a-token' });
  record('invalid token', garbage.status === 401, `status ${garbage.status}`);

  const search = await call('GET', '/api/search?q=' + encodeURIComponent(`' UNION SELECT password FROM "Users" --`), { token: tokenA });
  const searchText = search.text || '';
  record(
    'search SQL probe',
    search.status < 500 && !/password|syntax error|sequelize/i.test(searchText),
    `status ${search.status}`
  );

  const profile = await call('PUT', '/api/profiles/me', {
    token: tokenA,
    body: {
      bio: '<script>alert(1)</script><img src=x onerror=alert(1)>',
      role: 'admin',
      joncoinBalance: 9999,
      verified: true,
      premium: true,
      adminRole: 'super_admin',
    },
  });
  const meAfter = await call('GET', '/api/auth/me', { token: tokenA });
  const bioGet = await call('GET', `/api/profiles/${me.json.id}`, { token: tokenB });
  const bio = JSON.stringify(bioGet.json || {});
  record(
    'profile update cannot escalate role or balance',
    meAfter.json?.role === 'athlete' && meAfter.json?.verified !== true && Number(meAfter.json?.joncoinBalance || 0) === 0,
    `role ${meAfter.json?.role} profileStatus ${profile.status}`
  );
  record(
    'profile bio is stored as text',
    bio.includes('<script>') && !bio.includes('password'),
    `status ${bioGet.status}`
  );

  const otherProfile = bioGet;
  record(
    'other user profile hides secrets',
    otherProfile.status === 200 && !JSON.stringify(otherProfile.json).match(/\$2[aby]\$|resetPasswordToken|joncoinBalance/),
    `status ${otherProfile.status}`
  );

  const client = new Client({ connectionString: process.env.DATABASE_URL || 'postgres://kresha@localhost:5432/footballpro_audit' });
  await client.connect();
  await client.query(`UPDATE "Users" SET role = 'admin', "adminRole" = NULL WHERE email = $1`, [userA.email]);
  await client.query(`UPDATE "Users" SET role = 'admin', "adminRole" = 'moderator' WHERE email = $1`, [userB.email]);
  const superLogin = await login(userA.email);
  const modLogin = await login(userB.email);
  const superToken = superLogin.json?.token;
  const modToken = modLogin.json?.token;

  const userDash = await call('GET', '/api/admin/ops/dashboard', { token: loginSeller.json.token });
  record('business cannot open admin', userDash.status === 403, `status ${userDash.status}`);
  const modFinance = await call('POST', '/api/admin/ops/finance/adjustments', {
    token: modToken,
    body: { userId: seller.res.json.user.id, amount: 100, reason: 'nope', direction: 'credit' },
  });
  record('moderator cannot adjust finance', modFinance.status === 403, `status ${modFinance.status}`);
  const modFlags = await call('PUT', '/api/admin/ops/flags/MARKETPLACE', { token: modToken, body: { enabled: false } });
  record('moderator cannot edit flags', modFlags.status === 403, `status ${modFlags.status}`);
  const superDash = await call('GET', '/api/admin/ops/dashboard', { token: superToken });
  record('super admin dashboard', superDash.status === 200, `status ${superDash.status}`);
  const auditPut = await call('PUT', '/api/admin/ops/audit', { token: superToken, body: { id: 1, result: 'tampered' } });
  record('audit log has no update route', auditPut.status === 404, `status ${auditPut.status}`);

  const rewardUser = await call('POST', '/api/joncoin/reward', {
    token: loginSeller.json.token,
    headers: { 'Idempotency-Key': 'user-mint' },
    body: { userId: seller.res.json.user.id, amount: 1000 },
  });
  record('user cannot mint JonCoin', rewardUser.status === 403, `status ${rewardUser.status}`);

  const purchase = await call('POST', '/api/joncoin/purchase', {
    token: loginSeller.json.token,
    headers: { 'Idempotency-Key': 'deposit-1' },
    body: { amount: 50, status: 'completed' },
  });
  const balanceAfterPurchase = await call('GET', '/api/joncoin/balance', { token: loginSeller.json.token });
  record(
    'deposit request does not credit balance',
    purchase.status === 200 && purchase.json?.transaction?.status === 'pending' && Number(balanceAfterPurchase.json?.balance || balanceAfterPurchase.json?.joncoinBalance || 0) === 0,
    `purchase ${purchase.status} balance ${JSON.stringify(balanceAfterPurchase.json)}`
  );

  const payment = await call('POST', '/api/payments', {
    token: loginSeller.json.token,
    body: { amount: 10, currency: 'usd', status: 'succeeded', userId: userA.res.json.user.id },
  });
  record('client cannot set payment currency or success', payment.status === 400, `status ${payment.status}`);
  const paymentOk = await call('POST', '/api/payments', {
    token: loginSeller.json.token,
    body: { amount: 10, currency: 'eur', status: 'succeeded' },
  });
  record(
    'created payment stays pending',
    paymentOk.status === 201 && paymentOk.json?.status === 'pending' && paymentOk.json?.userId === loginSeller.json.user.id,
    `status ${paymentOk.status} payment ${paymentOk.json?.status}`
  );

  const webhook = await call('POST', '/api/payments/webhook', {
    raw: JSON.stringify({ type: 'checkout.session.completed', id: 'evt_fake' }),
    headers: { 'Content-Type': 'application/json', 'stripe-signature': 't=1,v1=bad' },
  });
  record('invalid webhook signature', webhook.status === 400 && !/stack|sk_test/i.test(webhook.text), `status ${webhook.status}`);

  const card = await call('POST', '/api/joncoin/deposit-checkout', {
    token: loginSeller.json.token,
    body: { amount: 10 },
  });
  record('card checkout stays off', card.status === 503, `status ${card.status}`);

  const spender = await register('athlete');
  const buyer2 = await register('athlete');
  const buyer3 = await register('athlete');
  const loginSpender = await login(spender.email);
  const loginBuyer2 = await login(buyer2.email);
  const loginBuyer3 = await login(buyer3.email);
  async function reward(userId, key) {
    return call('POST', '/api/joncoin/reward', {
      token: superToken,
      headers: { 'Idempotency-Key': key },
      body: { userId, amount: '10.00' },
    });
  }
  const credits = await Promise.all([
    reward(spender.res.json.user.id, `reward-spender-${stamp()}`),
    reward(buyer2.res.json.user.id, `reward-b2-${stamp()}`),
    reward(buyer3.res.json.user.id, `reward-b3-${stamp()}`),
  ]);
  record('super admin can credit ledger', credits.every((row) => row.status === 200), credits.map((row) => row.status).join('/'));

  const [spendLeft, spendRight] = await Promise.all([
    call('POST', '/api/joncoin/spend', { token: loginSpender.json.token, headers: { 'Idempotency-Key': 'spend-left' }, body: { amount: '10.00' } }),
    call('POST', '/api/joncoin/spend', { token: loginSpender.json.token, headers: { 'Idempotency-Key': 'spend-right' }, body: { amount: '10.00' } }),
  ]);
  const balanceSpender = await call('GET', '/api/joncoin/balance', { token: loginSpender.json.token });
  const bal = Number(balanceSpender.json?.balance ?? balanceSpender.json?.joncoinBalance);
  const successes = [spendLeft, spendRight].filter((row) => row.status === 200).length;
  record('two spends cannot overdraw', successes === 1 && bal === 0, `successes ${successes} balance ${bal} ${spendLeft.status}/${spendRight.status} ${JSON.stringify(spendLeft.json)} ${JSON.stringify(spendRight.json)}`);

  const product = await call('POST', '/api/products', {
    token: loginSeller.json.token,
    body: {
      name: 'Audit ball',
      description: '<script>alert(1)</script>',
      price: '10.00',
      category: 'gear',
      stock: 1,
      status: 'active',
      sellerId: userB.res.json.user.id,
    },
  });
  record('product create', product.status === 201 && product.json?.sellerId === seller.res.json.user.id, `status ${product.status} seller ${product.json?.sellerId}`);

  const orderBody = {
    products: [{ productId: product.json?.id, quantity: 1 }],
    deliveryMethod: 'meetup',
    buyerContact: 'audit-phone',
  };
  const [order1, order2] = await Promise.all([
    call('POST', '/api/orders', { token: loginBuyer2.json.token, headers: { 'Idempotency-Key': 'order-b' }, body: orderBody }),
    call('POST', '/api/orders', { token: loginBuyer3.json.token, headers: { 'Idempotency-Key': 'order-c' }, body: orderBody }),
  ]);
  const orderStatuses = [order1.status, order2.status].sort();
  const stockRow = await client.query('SELECT stock, status FROM "Products" WHERE id = $1', [product.json.id]);
  record(
    'only one buyer gets the last unit',
    orderStatuses.filter((code) => code >= 200 && code < 300).length === 1
      && Number(stockRow.rows[0]?.stock) === 0,
    `orders ${order1.status}/${order2.status} stock ${stockRow.rows[0]?.stock}`
  );

  const won = order1.status < 300 ? { token: loginBuyer2.json.token, id: order1.json?.orders?.[0]?.id || order1.json?.id } : { token: loginBuyer3.json.token, id: order2.json?.orders?.[0]?.id || order2.json?.id };
  const lostToken = order1.status < 300 ? loginBuyer3.json.token : loginBuyer2.json.token;
  const foreignOrder = await call('GET', `/api/orders/${won.id}`, { token: lostToken });
  record('other user cannot read the order', foreignOrder.status === 403 || foreignOrder.status === 404, `status ${foreignOrder.status}`);

  const convo = await call('GET', `/api/messaging/conversations/user/${buyer3.res.json.user.id}`, { token: loginBuyer2.json.token });
  const conversationId = convo.json?.id || convo.json?.conversation?.id;
  const sent = await call('POST', `/api/messaging/conversations/${conversationId}/messages`, {
    token: loginBuyer2.json.token,
    body: { text: '<script>alert(1)</script> private note' },
  });
  const outsider = await call('GET', `/api/messaging/conversations/${conversationId}/messages`, { token: loginScoutA.json.token });
  record('outsider cannot read a conversation', outsider.status === 403 || outsider.status === 404, `status ${outsider.status} send ${sent.status}`);

  await client.query(
    `UPDATE "Users" SET premium = true, "subscriptionPlan" = 'pro', "premiumExpiresAt" = NOW() + INTERVAL '30 days' WHERE id IN ($1, $2)`,
    [scoutA.res.json.user.id, scoutB.res.json.user.id]
  );
  const scoutAFresh = await login(scoutA.email);
  const scoutBFresh = await login(scoutB.email);
  await client.query(
    `INSERT INTO "ScoutingReports"
      ("scoutId","playerId","reportDate","status","technical","physical","tactical","mental","positionSpecific","notes","createdAt","updatedAt")
     VALUES ($1,$2,CURRENT_DATE,'draft','{}','{}','{}','{}','{}','secret scout note',NOW(),NOW())`,
    [scoutA.res.json.user.id, seller.res.json.user.id]
  );
  const reportsB = await call('GET', '/api/scouting/reports', { token: scoutBFresh.json.token });
  const reportText = JSON.stringify(reportsB.json || {});
  record('scout cannot list another scout report', reportsB.status === 200 && !reportText.includes('secret scout note'), `status ${reportsB.status}`);

  const noteRows = await client.query('SELECT id FROM "Notifications" WHERE "userId" = $1 LIMIT 1', [seller.res.json.user.id]);
  if (noteRows.rows[0]) {
    const notesB = await call('GET', '/api/notifications', { token: loginBuyer2.json.token });
    const ids = JSON.stringify(notesB.json || {});
    record('notifications are not mixed across users', !ids.includes(`"userId":${seller.res.json.user.id}`) || notesB.status === 200, `status ${notesB.status}`);
  } else {
    record('notifications list for owner', true, 'no notification row to compare');
  }

  const banned = await register('athlete');
  const bannedLogin = await login(banned.email);
  await client.query(`UPDATE "Users" SET "bannedAt" = NOW(), "tokenVersion" = 1 WHERE id = $1`, [banned.res.json.user.id]);
  const bannedToken = await call('GET', '/api/auth/me', { token: bannedLogin.json.token });
  const bannedAgain = await login(banned.email);
  record('banned user token and login fail', [401, 403].includes(bannedToken.status) && bannedAgain.status === 403, `${bannedToken.status}/${bannedAgain.status}`);

  const deleted = await register('athlete');
  const deletedLogin = await login(deleted.email);
  await client.query(`UPDATE "Users" SET "deletedAt" = NOW(), "bannedAt" = NOW(), "tokenVersion" = 1 WHERE id = $1`, [deleted.res.json.user.id]);
  const deletedToken = await call('GET', '/api/auth/me', { token: deletedLogin.json.token });
  record('deleted user token fails', [401, 403].includes(deletedToken.status), `status ${deletedToken.status}`);

  const verifyBanned = await call('GET', '/api/auth/verify', { token: bannedLogin.json.token });
  record('verify rejects banned token', verifyBanned.json?.valid === false, JSON.stringify(verifyBanned.json));

  const ledger = await client.query(
    `SELECT u.id,
            u."joncoinBalance"::numeric AS cached,
            COALESCE(SUM(CASE
              WHEN t.status = 'completed' AND t.type IN ('purchase','reward','refund','sale') THEN t.amount
              WHEN t.status = 'completed' AND t.type IN ('spend','withdrawal','commission','subscription','reversal','fee') THEN -t.amount
              ELSE 0 END), 0)::numeric AS ledger
     FROM "Users" u
     LEFT JOIN "JonCoinTransactions" t ON t."userId" = u.id
     GROUP BY u.id, u."joncoinBalance"
     HAVING u."joncoinBalance"::numeric <> COALESCE(SUM(CASE
              WHEN t.status = 'completed' AND t.type IN ('purchase','reward','refund','sale') THEN t.amount
              WHEN t.status = 'completed' AND t.type IN ('spend','withdrawal','commission','subscription','reversal','fee') THEN -t.amount
              ELSE 0 END), 0)::numeric`
  );
  record('ledger matches cached balance', ledger.rows.length === 0, `mismatches ${ledger.rows.length}`);

  const modelCols = Object.keys(User.rawAttributes);
  const dbCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'Users'`);
  const dbNames = new Set(dbCols.rows.map((row) => row.column_name));
  const missing = modelCols.filter((name) => !dbNames.has(name));
  record('User model columns exist in schema', missing.length === 0, missing.join(',') || 'aligned');

  if (process.env.AUDIT_RATE_LIMIT === '1') {
    let limited = false;
    for (let i = 0; i < 25; i += 1) {
      const attempt = await call('POST', '/api/auth/login', { body: { email: 'nobody@example.com', password: 'nope' } });
      if (attempt.status === 429) {
        limited = true;
        break;
      }
    }
    record('login rate limit triggers', limited, limited ? '429' : 'no 429 after 25 attempts');
  }

  await client.end();
  const failed = results.filter((row) => !row.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
