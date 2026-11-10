'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize, DataTypes } = require('sequelize');

const databaseUrl = process.env.XTALENTI_FINAL_MIGRATION_TEST_DATABASE_URL;

test('final media and athlete identity migration preserves ambiguous legacy rows and retries safely', {
  skip: !databaseUrl && 'Set XTALENTI_FINAL_MIGRATION_TEST_DATABASE_URL to an empty disposable PostgreSQL database',
}, async () => {
  const sequelize = new Sequelize(databaseUrl, { logging: false });
  const qi = sequelize.getQueryInterface();
  const migration = require('../migrations/20261110150000-add-cloudinary-retry-and-athlete-identities');
  const runUp = () => migration.up(qi, { ...DataTypes, fn: (...args) => Sequelize.fn(...args) });
  try {
    await sequelize.authenticate();
    await qi.createTable('TournamentClubPlayerStats', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
      tournamentClubEntryId: { type: DataTypes.INTEGER, allowNull: false },
      athleteName: { type: DataTypes.STRING, allowNull: false },
    });
    await qi.addIndex('TournamentClubPlayerStats', ['tournamentClubEntryId', 'athleteName'], { unique: true, name: 'tournament_club_player_stats_entry_name_uq' });
    await qi.createTable('MatchScorers', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
      userId: { type: DataTypes.INTEGER, allowNull: true },
      athleteName: { type: DataTypes.STRING, allowNull: true },
    });
    await qi.createTable('PlayerMatchStats', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
      userId: { type: DataTypes.INTEGER, allowNull: true },
      athleteName: { type: DataTypes.STRING, allowNull: true },
    });
    await qi.createTable('LiveStreamReplays', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
      videoUrl: { type: DataTypes.STRING, allowNull: true },
    });
    await qi.bulkInsert('TournamentClubPlayerStats', [
      { id: 1, tournamentClubEntryId: 9, athleteName: 'Alex Smith' },
    ]);
    await qi.bulkInsert('MatchScorers', [
      { id: 1, userId: null, athleteName: 'Alex Smith' },
      { id: 2, userId: null, athleteName: 'Alex Smith' },
      { id: 3, userId: 7, athleteName: 'Registered Player' },
    ]);
    await qi.bulkInsert('PlayerMatchStats', [
      { id: 1, userId: null, athleteName: 'Alex Smith' },
      { id: 2, userId: null, athleteName: 'Alex Smith' },
      { id: 3, userId: 7, athleteName: 'Registered Player' },
    ]);

    await runUp();
    await runUp();
    await qi.bulkInsert('TournamentClubPlayerStats', [
      { id: 2, tournamentClubEntryId: 9, athleteName: 'Alex Smith', athleteIdentityKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
      { id: 3, tournamentClubEntryId: 9, athleteName: 'Alex Smith', athleteIdentityKey: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    ]);
    const [clubStats] = await sequelize.query('SELECT "athleteIdentityKey" FROM "TournamentClubPlayerStats" ORDER BY "id"');
    const [scorers] = await sequelize.query('SELECT "userId", "athleteIdentityKey" FROM "MatchScorers" ORDER BY "id"');
    const [playerStats] = await sequelize.query('SELECT "userId", "athleteIdentityKey" FROM "PlayerMatchStats" ORDER BY "id"');
    const replayColumns = await qi.describeTable('LiveStreamReplays');
    const clubIndexes = await qi.showIndex('TournamentClubPlayerStats');

    assert.ok(clubStats.every((row) => row.athleteIdentityKey));
    assert.equal(new Set(clubStats.map((row) => row.athleteIdentityKey)).size, 3, 'same-name rows can retain distinct stable identities');
    for (const rows of [scorers, playerStats]) {
      assert.ok(rows[0].athleteIdentityKey && rows[1].athleteIdentityKey);
      assert.notEqual(rows[0].athleteIdentityKey, rows[1].athleteIdentityKey, 'same-name legacy rows are never auto-merged');
      assert.equal(rows[2].athleteIdentityKey, null, 'registered athlete rows continue using userId');
    }
    assert.equal(replayColumns.updatedAt.allowNull, false);
    assert.ok(clubIndexes.some((index) => index.name === 'tournament_club_player_stats_entry_identity_uq'));
    await assert.rejects(() => migration.down(qi), /retained|roll back application code only/i);
  } finally {
    for (const table of ['CloudinaryMediaJobs', 'LiveStreamReplays', 'PlayerMatchStats', 'MatchScorers', 'TournamentClubPlayerStats']) {
      try { await qi.dropTable(table); } catch { /* disposable integration fixture */ }
    }
    await sequelize.close();
  }
});
