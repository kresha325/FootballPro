'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize, DataTypes } = require('sequelize');

test('PostgreSQL league fixture migration preserves legacy rows, permits unknown scorers, and refuses destructive rollback', {
  skip: !process.env.LEAGUE_MIGRATION_TEST_DATABASE_URL && 'Set LEAGUE_MIGRATION_TEST_DATABASE_URL to a disposable PostgreSQL database',
}, async () => {
  const sequelize = new Sequelize(process.env.LEAGUE_MIGRATION_TEST_DATABASE_URL, { logging: false });
  const qi = sequelize.getQueryInterface();
  const migration = require('../migrations/20261110100000-support-league-entry-fixtures-and-unknown-athletes');
  try {
    await sequelize.authenticate();
    await qi.createTable('Users', { id: { type: DataTypes.INTEGER, primaryKey: true } });
    await qi.createTable('Tournaments', { id: { type: DataTypes.INTEGER, primaryKey: true } });
    await qi.createTable('TournamentClubEntries', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
      tournamentId: { type: DataTypes.INTEGER, references: { model: 'Tournaments', key: 'id' } },
    });
    await qi.createTable('Matches', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
      tournamentId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Tournaments', key: 'id' } },
      homeUserId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } },
      awayUserId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' } },
    });
    await qi.createTable('MatchScorers', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
      matchId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Matches', key: 'id' } },
      userId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } },
    });
    await qi.createTable('PlayerMatchStats', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
      matchId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Matches', key: 'id' } },
      userId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } },
    });
    await qi.bulkInsert('Users', [{ id: 1 }, { id: 2 }]);
    await qi.bulkInsert('Tournaments', [{ id: 1 }]);
    await qi.bulkInsert('Matches', [{ id: 1, tournamentId: 1, homeUserId: 1, awayUserId: 2 }]);
    await qi.bulkInsert('MatchScorers', [{ id: 1, matchId: 1, userId: 1 }]);
    await qi.bulkInsert('PlayerMatchStats', [{ id: 1, matchId: 1, userId: 1 }]);

    await migration.up(qi, DataTypes);
    const matchColumns = await qi.describeTable('Matches');
    const scorerColumns = await qi.describeTable('MatchScorers');
    const statColumns = await qi.describeTable('PlayerMatchStats');
    assert.equal(matchColumns.homeUserId.allowNull, true);
    assert.equal(scorerColumns.userId.allowNull, true);
    assert.equal(statColumns.userId.allowNull, true);
    assert.ok(matchColumns.homeClubEntryId && matchColumns.awayClubEntryId && matchColumns.winnerClubEntryId);
    assert.ok(scorerColumns.athleteName && statColumns.athleteName);
    assert.ok((await qi.showIndex('Matches')).some((index) => index.name === 'matches_home_club_entry_idx'));
    const [[legacyMatch]] = await sequelize.query('SELECT "homeUserId" FROM "Matches" WHERE "id" = 1');
    const [[legacyScorer]] = await sequelize.query('SELECT "userId" FROM "MatchScorers" WHERE "id" = 1');
    assert.equal(legacyMatch.homeUserId, 1, 'legacy fixture row survives the additive migration');
    assert.equal(legacyScorer.userId, 1, 'legacy scorer row survives the additive migration');

    await qi.bulkInsert('MatchScorers', [{ id: 2, matchId: 1, userId: null, athleteName: 'Unknown Athlete' }]);
    await qi.bulkInsert('PlayerMatchStats', [{ id: 2, matchId: 1, userId: null, athleteName: 'Unknown Athlete' }]);
    await assert.rejects(() => migration.down(qi), /Cannot rollback league entry fixtures/);
    await qi.bulkDelete('MatchScorers', { id: 2 });
    await qi.bulkDelete('PlayerMatchStats', { id: 2 });
    await migration.down(qi, DataTypes);
    assert.equal((await qi.describeTable('MatchScorers')).userId.allowNull, false, 'safe rollback restores legacy not-null contract');
    assert.equal((await qi.describeTable('Matches')).homeUserId.allowNull, false);
  } finally {
    for (const table of ['PlayerMatchStats', 'MatchScorers', 'Matches', 'TournamentClubEntries', 'Tournaments', 'Users']) {
      try { await qi.dropTable(table); } catch { /* test fixture cleanup */ }
    }
    await sequelize.close();
  }
});
