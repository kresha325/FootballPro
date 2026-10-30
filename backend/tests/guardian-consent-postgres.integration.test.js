'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize, DataTypes } = require('sequelize');

test('PostgreSQL consent-event migration has durable foreign keys and repairable indexes', {
  skip: !process.env.GUARDIAN_TEST_DATABASE_URL && 'Set GUARDIAN_TEST_DATABASE_URL to a disposable PostgreSQL database',
}, async () => {
  const sequelize = new Sequelize(process.env.GUARDIAN_TEST_DATABASE_URL, { logging: false });
  const qi = sequelize.getQueryInterface();
  const runMigration = (migration) => migration.up(qi, {
    ...DataTypes,
    fn: (...args) => Sequelize.fn(...args),
  });
  try {
    await sequelize.authenticate();
    await qi.createTable('Users', { id: { type: DataTypes.INTEGER, primaryKey: true } });
    await qi.createTable('GuardianConsents', { id: { type: DataTypes.INTEGER, primaryKey: true } });
    await qi.createTable('Gallery', { id: { type: DataTypes.INTEGER, primaryKey: true } });
    const eventsMigration = require('../migrations/20261030170000-create-guardian-consent-events');
    await runMigration(eventsMigration);
    const repair = require('../migrations/20261030230000-repair-guardian-event-indexes-add-gallery-public-id');
    await runMigration(repair);
    const indexes = await qi.showIndex('GuardianConsentEvents');
    assert.ok(indexes.some((index) => index.name === 'guardian_consent_events_minor_time_idx'));
    assert.ok(indexes.some((index) => index.name === 'guardian_consent_events_consent_time_idx'));
    assert.ok((await qi.describeTable('Gallery')).publicId);
    await qi.bulkInsert('Users', [{ id: 1 }, { id: 2 }]);
    await qi.bulkInsert('GuardianConsents', [{ id: 1 }]);
    await qi.bulkInsert('GuardianConsentEvents', [{ consentId: 1, minorUserId: 1, actorUserId: 2, actorType: 'user', eventType: 'verified', metadata: '{}', eventAt: new Date(), createdAt: new Date() }]);
    await assert.rejects(() => qi.bulkDelete('Users', { id: 1 }), /foreign key|violates|constraint/i);
    await qi.bulkDelete('Users', { id: 2 });
    const [events] = await sequelize.query('SELECT "actorUserId" FROM "GuardianConsentEvents" WHERE "consentId" = 1');
    assert.equal(events[0]?.actorUserId, null, 'optional actor uses ON DELETE SET NULL');
    await assert.rejects(() => eventsMigration.down(qi), /preserve it during rollback/);
  } finally {
    for (const table of ['GuardianConsentEvents', 'GuardianConsents', 'Users', 'Gallery']) {
      try { await qi.dropTable(table); } catch { /* clean disposable fixture */ }
    }
    await sequelize.close();
  }
});
