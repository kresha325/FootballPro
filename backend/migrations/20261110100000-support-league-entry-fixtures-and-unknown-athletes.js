'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
    await queryInterface.changeColumn('Matches', 'homeUserId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    }, { transaction });
    await queryInterface.addColumn('Matches', 'homeClubEntryId', {
      type: Sequelize.INTEGER, allowNull: true,
      references: { model: 'TournamentClubEntries', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
    }, { transaction });
    await queryInterface.addColumn('Matches', 'awayClubEntryId', {
      type: Sequelize.INTEGER, allowNull: true,
      references: { model: 'TournamentClubEntries', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
    }, { transaction });
    await queryInterface.addColumn('Matches', 'winnerClubEntryId', {
      type: Sequelize.INTEGER, allowNull: true,
      references: { model: 'TournamentClubEntries', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
    }, { transaction });
    await queryInterface.addColumn('Matches', 'homeName', { type: Sequelize.STRING(160), allowNull: true }, { transaction });
    await queryInterface.addColumn('Matches', 'awayName', { type: Sequelize.STRING(160), allowNull: true }, { transaction });
    await queryInterface.addIndex('Matches', ['homeClubEntryId'], { name: 'matches_home_club_entry_idx', transaction });
    await queryInterface.addIndex('Matches', ['awayClubEntryId'], { name: 'matches_away_club_entry_idx', transaction });

    await queryInterface.changeColumn('MatchScorers', 'userId', {
      type: Sequelize.INTEGER, allowNull: true,
      references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
    }, { transaction });
    await queryInterface.addColumn('MatchScorers', 'athleteName', { type: Sequelize.STRING(160), allowNull: true }, { transaction });
    await queryInterface.changeColumn('PlayerMatchStats', 'userId', {
      type: Sequelize.INTEGER, allowNull: true,
      references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
    }, { transaction });
    await queryInterface.addColumn('PlayerMatchStats', 'athleteName', { type: Sequelize.STRING(160), allowNull: true }, { transaction });
    await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
    // Refuse rollback that would discard any unknown-athlete records.
    const [scorers] = await queryInterface.sequelize.query('SELECT COUNT(*)::int AS count FROM "MatchScorers" WHERE "userId" IS NULL', { transaction });
    const [stats] = await queryInterface.sequelize.query('SELECT COUNT(*)::int AS count FROM "PlayerMatchStats" WHERE "userId" IS NULL', { transaction });
    const [fixtures] = await queryInterface.sequelize.query('SELECT COUNT(*)::int AS count FROM "Matches" WHERE "homeClubEntryId" IS NOT NULL OR "awayClubEntryId" IS NOT NULL OR "winnerClubEntryId" IS NOT NULL', { transaction });
    if (Number(scorers[0]?.count) || Number(stats[0]?.count) || Number(fixtures[0]?.count)) {
      throw new Error('Cannot rollback league entry fixtures while entry-based teams or unknown-athlete statistics exist.');
    }
    await queryInterface.removeColumn('PlayerMatchStats', 'athleteName', { transaction });
    await queryInterface.changeColumn('PlayerMatchStats', 'userId', { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } }, { transaction });
    await queryInterface.removeColumn('MatchScorers', 'athleteName', { transaction });
    await queryInterface.changeColumn('MatchScorers', 'userId', { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } }, { transaction });
    await queryInterface.removeIndex('Matches', 'matches_home_club_entry_idx', { transaction });
    await queryInterface.removeIndex('Matches', 'matches_away_club_entry_idx', { transaction });
    await queryInterface.removeColumn('Matches', 'awayName', { transaction });
    await queryInterface.removeColumn('Matches', 'homeName', { transaction });
    await queryInterface.removeColumn('Matches', 'winnerClubEntryId', { transaction });
    await queryInterface.removeColumn('Matches', 'awayClubEntryId', { transaction });
    await queryInterface.removeColumn('Matches', 'homeClubEntryId', { transaction });
    await queryInterface.changeColumn('Matches', 'homeUserId', { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } }, { transaction });
    await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
