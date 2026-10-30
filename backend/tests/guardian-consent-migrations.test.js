'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const eventsMigration = require('../migrations/20261030170000-create-guardian-consent-events');
const repairMigration = require('../migrations/20261030230000-repair-guardian-event-indexes-add-gallery-public-id');

test('consent event migration adds missing indexes even when the table already exists', async () => {
  const indexesAdded = [];
  const qi = {
    showAllTables: async () => ['Users', 'GuardianConsents', 'GuardianConsentEvents'],
    showIndex: async () => [],
    addIndex: async (_table, fields, options) => indexesAdded.push({ fields, name: options.name }),
  };
  await eventsMigration.up(qi, {});
  assert.deepEqual(indexesAdded.map((index) => index.name), [
    'guardian_consent_events_minor_time_idx', 'guardian_consent_events_consent_time_idx',
  ]);
});

test('repair migration checks event columns, repairs indexes, and adds publicId to Sequelize Galleries table', async () => {
  const added = [];
  const eventColumns = Object.fromEntries(['id', 'consentId', 'minorUserId', 'actorUserId', 'actorType', 'eventType', 'metadata', 'eventAt', 'createdAt'].map((name) => [name, {}]));
  const qi = {
    showAllTables: async () => ['GuardianConsentEvents', 'Galleries'],
    describeTable: async (table) => table === 'GuardianConsentEvents' ? eventColumns : { id: {} },
    showIndex: async () => [],
    addIndex: async (_table, fields, options) => added.push({ fields, name: options.name }),
    addColumn: async (table, name, definition) => added.push({ table, name, definition }),
  };
  await repairMigration.up(qi, { STRING: (length) => ({ type: 'string', length }) });
  assert.equal(added.filter((entry) => entry.fields).length, 2);
  assert.ok(added.some((entry) => entry.table === 'Galleries' && entry.name === 'publicId'));
});

test('audit migration rollback refuses to delete consent event history', async () => {
  await assert.rejects(() => eventsMigration.down(), /preserve it during rollback/);
  await assert.rejects(() => repairMigration.up({ showAllTables: async () => ['Galleries'] }, {}), /GuardianConsentEvents is missing/);
});
