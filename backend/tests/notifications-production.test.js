const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../services/notifications/policy');
const { createRuntime } = require('../services/notifications/service');

function memoryRepo() {
  const rows = [];
  const prefs = [];
  const devices = [];
  let id = 1;
  const decorate = (row) => {
    row.update = async (patch) => {
      Object.assign(row, patch);
    };
    return row;
  };
  return {
    rows,
    devices,
    prefs,
    async findByIdempotency(key) {
      return rows.find((row) => row.idempotencyKey === key) || null;
    },
    async findRecentDuplicate(userId, key) {
      return rows.find((row) => row.userId === userId && (row.idempotencyKey === key || row.metadata?.idempotencyKey === key)) || null;
    },
    async findAggregate(userId, type, entityType, entityId) {
      return [...rows].reverse().find((row) => (
        row.userId === userId && row.type === type && row.entityType === entityType && Number(row.entityId) === Number(entityId) && !row.isRead
      )) || null;
    },
    async insert(data) {
      if (data.idempotencyKey && rows.some((row) => row.idempotencyKey === data.idempotencyKey)) {
        const existing = rows.find((row) => row.idempotencyKey === data.idempotencyKey);
        existing.duplicate = true;
        return existing;
      }
      const row = decorate({ ...data, id: id++, createdAt: new Date(), isRead: Boolean(data.isRead) });
      rows.push(row);
      return row;
    },
    async reload(rowId) {
      return rows.find((row) => row.id === rowId) || null;
    },
    async list(userId, query) {
      const parsed = policy.parseListQuery(query);
      const now = Date.now();
      let visible = rows.filter((row) => (
        row.userId === userId
        && row.type !== 'message'
        && (!row.expiresAt || new Date(row.expiresAt).getTime() > now)
      ));
      if (parsed.unreadOnly) visible = visible.filter((row) => !row.isRead);
      if (parsed.category) visible = visible.filter((row) => row.category === parsed.category);
      return { ...parsed, total: visible.length, rows: visible.slice(parsed.offset, parsed.offset + parsed.limit) };
    },
    async unread(userId) {
      const now = Date.now();
      const visible = rows.filter((row) => (
        row.userId === userId && !row.isRead && row.type !== 'message' && (!row.expiresAt || new Date(row.expiresAt).getTime() > now)
      ));
      const byCategory = {};
      visible.forEach((row) => {
        const key = row.category || 'SYSTEM';
        byCategory[key] = (byCategory[key] || 0) + 1;
      });
      return { count: visible.length, byCategory };
    },
    async findOwned(userId, rawId) {
      const numericId = Number(rawId);
      if (!Number.isInteger(numericId) || numericId <= 0) return { invalid: true };
      return { row: rows.find((row) => row.id === numericId && row.userId === userId) || null };
    },
    async markAll(userId) {
      const now = new Date();
      rows.forEach((row) => {
        if (row.userId === userId && !row.isRead && row.type !== 'message') {
          row.isRead = true;
          row.readAt = now;
        }
      });
    },
    async destroyOwned(row) {
      const index = rows.indexOf(row);
      if (index >= 0) rows.splice(index, 1);
    },
    async loadPreferences() { return prefs; },
    async savePreferences(_userId, preferences) {
      prefs.splice(0, prefs.length, ...preferences);
    },
    async preferenceFor(_userId, category) {
      return prefs.find((row) => row.category === category) || null;
    },
    async loadUser(userId) {
      return { id: userId, email: `user${userId}@example.com`, firstName: 'Test' };
    },
    async listDevices(userId) { return devices.filter((device) => device.userId === userId && device.enabled); },
    async upsertDevice(input) {
      let row = devices.find((device) => device.tokenKey === String(input.token).slice(0, 191))
        || devices.find((device) => input.deviceId && device.userId === input.userId && device.deviceId === input.deviceId);
      if (!row) {
        row = { id: devices.length + 1 };
        devices.push(row);
      }
      Object.assign(row, {
        userId: input.userId,
        platform: input.platform,
        token: String(input.token),
        tokenKey: String(input.token).slice(0, 191),
        deviceId: input.deviceId || row.deviceId || null,
        enabled: true,
        lastSeenAt: new Date(),
      });
      return row;
    },
    async disableToken(tokenKey) {
      devices.forEach((device) => {
        if (device.tokenKey === tokenKey || device.token === tokenKey) device.enabled = false;
      });
    },
    async disableUserDevice({ userId, deviceId }) {
      devices.forEach((device) => {
        if (device.userId === userId && device.deviceId === deviceId) device.enabled = false;
      });
    },
    async syncLegacyToken() {},
  };
}

function runtime() {
  const repo = memoryRepo();
  const pushes = [];
  const emails = [];
  const emitted = [];
  const api = createRuntime({
    repo,
    push: async (...args) => {
      pushes.push(args);
    },
    email: async (...args) => {
      emails.push(args);
    },
    emit: (...args) => {
      emitted.push(args);
    },
    badge: async () => 1,
  });
  return { api, repo, pushes, emails, emitted };
}

describe('notification policy', () => {
  it('builds stable match, order and wallet keys', () => {
    const first = policy.buildMatchNotice({
      match: { id: 123, tournamentId: 9, matchDate: '2026-10-06T18:00:00.000Z', reminderWindow: '24h' },
      tournament: { id: 9, name: 'Kupa' },
      userId: 456,
      kind: 'starting',
    });
    const second = policy.buildMatchNotice({
      match: { id: 123, tournamentId: 9, matchDate: '2026-10-06T18:00:00.000Z', reminderWindow: '24h' },
      tournament: { id: 9, name: 'Kupa' },
      userId: 456,
      kind: 'starting',
    });
    assert.equal(first.idempotencyKey, second.idempotencyKey);
    assert.equal(first.eventType, 'MATCH_STARTING');
    assert.equal(first.link, '/matches/123');
    assert.equal(policy.orderEventForStatus('shipped'), 'ORDER_SHIPPED');
    assert.equal(policy.walletEventFor({ type: 'withdrawal', status: 'pending' }), 'WALLET_WITHDRAWAL');
    assert.match(policy.aggregateCopy('like', 25, 'Ana'), /25 pëlqime/);
  });

  it('keeps security delivery on when preferences are off', () => {
    const off = { inApp: false, push: false, email: false };
    const security = policy.deliveryDecision('PASSWORD_CHANGED', off);
    assert.equal(security.inApp, true);
    assert.equal(security.push, true);
    assert.equal(security.email, true);
    assert.equal(security.priority, 'CRITICAL');
    const like = policy.deliveryDecision('POST_LIKED', { inApp: true, push: false, email: true });
    assert.equal(like.push, false);
    assert.equal(like.email, false);
  });

  it('rejects invalid preference categories and paginates', () => {
    assert.equal(policy.sanitizePreferences({ preferences: [{ category: 'NOPE', inApp: true }] }).ok, false);
    const parsed = policy.parseListQuery({ page: '2', limit: '500', unreadOnly: 'true', category: 'football' });
    assert.equal(parsed.page, 2);
    assert.equal(parsed.limit, 50);
    assert.equal(parsed.category, 'FOOTBALL');
    assert.equal(parsed.unreadOnly, true);
  });
});

describe('notification runtime', () => {
  it('creates, reads, marks and counts without duplicating an event', async () => {
    const { api, repo, pushes, emails } = runtime();
    const created = await api.notify({
      userId: 7,
      actorId: 3,
      eventType: 'FOLLOW',
      title: 'Ndjekës i ri',
      message: 'Ana të ndjek',
      entityType: 'user',
      entityId: 3,
      idempotencyKey: 'follow:3:user:7',
    });
    assert.equal(created.userId, 7);
    assert.equal(repo.rows.length, 1);
    assert.equal(pushes.length, 1);
    assert.equal(emails.length, 0);

    const duplicate = await api.notify({
      userId: 7,
      actorId: 3,
      eventType: 'FOLLOW',
      title: 'Ndjekës i ri',
      message: 'Ana të ndjek',
      entityType: 'user',
      entityId: 3,
      idempotencyKey: 'follow:3:user:7',
    });
    assert.equal(duplicate.duplicate, true);
    assert.equal(repo.rows.length, 1);

    const unread = await api.unread(7);
    assert.equal(unread.count, 1);
    const listed = await api.list(7, { page: 1, limit: 10 });
    assert.equal(listed.total, 1);
    assert.equal(listed.notifications[0].entityType, 'user');

    const marked = await api.markRead(7, created.id);
    assert.equal(marked.status, 200);
    assert.equal(repo.rows[0].isRead, true);
    assert.ok(repo.rows[0].readAt);
    const unreadAgain = await api.markUnread(7, created.id);
    assert.equal(unreadAgain.status, 200);
    assert.equal(repo.rows[0].isRead, false);
    await api.markAllRead(7);
    assert.equal((await api.unread(7)).count, 0);

    const foreign = await api.markRead(8, created.id);
    assert.equal(foreign.status, 404);
    const badId = await api.markRead(7, 'abc');
    assert.equal(badId.status, 400);
  });

  it('aggregates likes, skips push when disabled, and still saves when push throws', async () => {
    const repo = memoryRepo();
    const pushes = [];
    let fail = false;
    const api = createRuntime({
      repo,
      push: async (...args) => {
        if (fail) throw new Error('push down');
        pushes.push(args);
      },
      email: async () => {},
      emit: () => {},
      badge: async () => 0,
    });
    await api.savePreferences(4, { preferences: [{ category: 'SOCIAL', inApp: true, push: false, email: false }] });
    await api.notify({
      userId: 4,
      actorId: 9,
      eventType: 'POST_LIKED',
      actorName: 'Ana',
      title: 'Pëlqim i ri',
      message: 'Ana pëlqeu postimin tuaj',
      entityType: 'post',
      entityId: 15,
    });
    await api.notify({
      userId: 4,
      actorId: 10,
      eventType: 'POST_LIKED',
      actorName: 'Ben',
      title: 'Pëlqim i ri',
      message: 'Ben pëlqeu postimin tuaj',
      entityType: 'post',
      entityId: 15,
    });
    assert.equal(repo.rows.length, 1);
    assert.match(repo.rows[0].message, /2 pëlqime/);
    assert.equal(pushes.length, 0);

    fail = true;
    const saved = await api.notify({
      userId: 4,
      allowSelf: true,
      eventType: 'PASSWORD_CHANGED',
      title: 'Fjalëkalimi u ndryshua',
      message: 'Kontrollo llogarinë',
      entityType: 'user',
      entityId: 4,
      idempotencyKey: 'password:4:once',
    });
    assert.equal(saved.eventType, 'PASSWORD_CHANGED');
    assert.equal(saved.priority, 'CRITICAL');
  });

  it('registers multiple devices, refreshes a token, and removes only the logged-out device', async () => {
    const { api, repo } = runtime();
    const first = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaa]';
    const second = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbb]';
    const refreshed = 'ExponentPushToken[cccccccccccccccccccc]';
    const invalid = await api.registerDevice({ userId: 1, platform: 'mobile', token: 'not-a-token', deviceId: 'phone-a' });
    assert.equal(invalid.error, 'invalid_token');
    assert.equal(repo.devices.length, 0);

    await api.registerDevice({ userId: 1, platform: 'mobile', token: first, deviceId: 'phone-a' });
    await api.registerDevice({ userId: 1, platform: 'mobile', token: second, deviceId: 'phone-b' });
    assert.equal(repo.devices.filter((device) => device.enabled).length, 2);
    await api.registerDevice({ userId: 1, platform: 'mobile', token: refreshed, deviceId: 'phone-a' });
    assert.equal(repo.devices.length, 2);
    assert.equal(repo.devices.find((device) => device.deviceId === 'phone-a').token, refreshed);
    await api.registerDevice({ userId: 1, platform: 'mobile', token: null, deviceId: 'phone-a' });
    assert.equal(repo.devices.find((device) => device.deviceId === 'phone-a').enabled, false);
    assert.equal(repo.devices.find((device) => device.deviceId === 'phone-b').enabled, true);
  });

  it('paginates, hides expired rows, and emails only the important channel', async () => {
    const { api, repo, emails } = runtime();
    await api.notify({
      userId: 2,
      eventType: 'MATCH_STARTING',
      title: 'Ndeshja po fillon',
      message: 'Së shpejti',
      entityType: 'match',
      entityId: 5,
      expiresAt: new Date(Date.now() - 1000),
      idempotencyKey: 'match:5:starting:start:user:2',
    });
    await api.notify({
      userId: 2,
      actorId: 8,
      eventType: 'ORDER_SHIPPED',
      title: 'Porosia u dërgua',
      message: 'Porosia #4 u dërgua.',
      entityType: 'order',
      entityId: 4,
      idempotencyKey: 'order:4:ORDER_SHIPPED:user:2',
    });
    await api.notify({
      userId: 2,
      eventType: 'PLAYER_ACHIEVEMENT',
      title: 'Arritje e re',
      message: 'Zhbllokove Kupën',
      entityType: 'player',
      entityId: 2,
      allowSelf: true,
      idempotencyKey: 'achievement:1:user:2',
    });
    const page = await api.list(2, { page: 1, limit: 1 });
    assert.equal(page.notifications.length, 1);
    assert.equal(page.total, 2);
    assert.equal((await api.unread(2)).count, 2);
    assert.equal(repo.rows.length, 3);
    assert.equal(emails.length, 1);
    assert.equal(emails[0][1], 'Porosia u dërgua');
  });
});
