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
    await qi.createTable('GuardianConsents', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
      minorUserId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } },
      guardianEmail: { type: DataTypes.STRING(320), allowNull: false },
      consentPurpose: { type: DataTypes.STRING(64), allowNull: false },
      consentScope: { type: DataTypes.JSON, allowNull: false },
      policyVersion: { type: DataTypes.STRING(32), allowNull: false },
      verificationMethod: { type: DataTypes.STRING(48), allowNull: false },
      verifiedAt: { type: DataTypes.DATE, allowNull: true },
      revokedAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await qi.createTable('Galleries', { id: { type: DataTypes.INTEGER, primaryKey: true } });
    const eventsMigration = require('../migrations/20261030170000-create-guardian-consent-events');
    await runMigration(eventsMigration);
    const repair = require('../migrations/20261030230000-repair-guardian-event-indexes-add-gallery-public-id');
    await runMigration(repair);
    const expiryMigration = require('../migrations/20261110120000-expire-minor-communication-consents');
    const competitionAuditMigration = require('../migrations/20261110130000-create-competition-audit-events');
    await qi.createTable('Tournaments', { id: { type: DataTypes.INTEGER, primaryKey: true } });
    await qi.bulkInsert('Tournaments', [{ id: 1 }]);
    await runMigration(expiryMigration);
    await runMigration(competitionAuditMigration);
    const indexes = await qi.showIndex('GuardianConsentEvents');
    assert.ok(indexes.some((index) => index.name === 'guardian_consent_events_minor_time_idx'));
    assert.ok(indexes.some((index) => index.name === 'guardian_consent_events_consent_time_idx'));
    assert.ok((await qi.describeTable('Galleries')).publicId);
    await qi.bulkInsert('Users', [{ id: 1 }, { id: 2 }]);
    const now = Date.now();
    await qi.bulkInsert('GuardianConsents', [
      { id: 1, minorUserId: 1, guardianEmail: 'guardian@example.test', consentPurpose: 'minor_communication', consentScope: JSON.stringify({ adultUserId: 2, channels: ['direct_message'] }), policyVersion: 'test', verificationMethod: 'email', verifiedAt: new Date(now - 2 * 365 * 24 * 60 * 60 * 1000), revokedAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 2, minorUserId: 1, guardianEmail: 'guardian@example.test', consentPurpose: 'minor_communication', consentScope: JSON.stringify({ adultUserId: 2, channels: ['call'] }), policyVersion: 'test', verificationMethod: 'email', verifiedAt: new Date(now - 30 * 24 * 60 * 60 * 1000), revokedAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 3, minorUserId: 1, guardianEmail: 'guardian@example.test', consentPurpose: 'account_access', consentScope: JSON.stringify({}), policyVersion: 'test', verificationMethod: 'email', verifiedAt: new Date(now - 30 * 24 * 60 * 60 * 1000), revokedAt: null, createdAt: new Date(), updatedAt: new Date() },
    ]);
    await runMigration(expiryMigration); // the deploy migration is safe to retry if an operator reruns it
    const [consents] = await sequelize.query('SELECT "id", "consentExpiresAt" FROM "GuardianConsents" ORDER BY "id"');
    assert.ok(new Date(consents.find((row) => row.id === 1).consentExpiresAt).getTime() < Date.now(), 'legacy approval older than one year is expired');
    assert.ok(new Date(consents.find((row) => row.id === 2).consentExpiresAt).getTime() > Date.now(), 'recent legacy approval gets remaining validity');
    assert.equal(consents.find((row) => row.id === 3).consentExpiresAt, null, 'account consent remains independent and unbounded');
    const competitionAuditEvents = require('../migrations/20261110130000-create-competition-audit-events');
    await qi.bulkInsert('CompetitionAuditEvents', [{ tournamentId: 1, matchId: 99, actorUserId: 2, eventType: 'fixture_deleted', metadata: JSON.stringify({ retained: true }), eventAt: new Date(), createdAt: new Date(), updatedAt: new Date() }]);
    await qi.bulkInsert('GuardianConsentEvents', [{ consentId: 1, minorUserId: 1, actorUserId: 2, actorType: 'user', eventType: 'verified', metadata: '{}', eventAt: new Date(), createdAt: new Date() }]);
    await assert.rejects(() => qi.bulkDelete('Users', { id: 1 }), /foreign key|violates|constraint/i);
    await qi.bulkDelete('Users', { id: 2 });
    const [events] = await sequelize.query('SELECT "actorUserId" FROM "GuardianConsentEvents" WHERE "consentId" = 1');
    assert.equal(events[0]?.actorUserId, null, 'optional actor uses ON DELETE SET NULL');
    await assert.rejects(() => eventsMigration.down(qi), /preserve it during rollback/);
    await assert.rejects(() => expiryMigration.down(qi), /Do not remove communication consent expiry/);
    await assert.rejects(() => competitionAuditEvents.down(qi), /append-only/);
  } finally {
    for (const table of ['CompetitionAuditEvents', 'Tournaments', 'GuardianConsentEvents', 'GuardianConsents', 'Users', 'Galleries']) {
      try { await qi.dropTable(table); } catch { /* clean disposable fixture */ }
    }
    await sequelize.close();
  }
});
