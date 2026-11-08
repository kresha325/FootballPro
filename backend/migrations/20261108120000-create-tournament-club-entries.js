'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('TournamentClubEntries', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      tournamentId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Tournaments', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      clubUserId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      clubName: { type: Sequelize.STRING(160), allowNull: false },
      groupName: { type: Sequelize.STRING(8), allowNull: true },
      claimStatus: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'unclaimed' },
      claimRequestedBy: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      played: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      wins: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      draws: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      losses: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      goalsFor: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      goalsAgainst: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      points: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('TournamentClubEntries', ['tournamentId', 'clubUserId'], { unique: true, name: 'tournament_club_entries_tournament_club_uq' });
    await queryInterface.addIndex('TournamentClubEntries', ['tournamentId', 'groupName'], { name: 'tournament_club_entries_group_idx' });

    await queryInterface.createTable('TournamentClubPlayerStats', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      tournamentClubEntryId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'TournamentClubEntries', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      athleteUserId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      athleteName: { type: Sequelize.STRING(160), allowNull: false },
      goals: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      assists: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      updatedByUserId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('TournamentClubPlayerStats', ['tournamentClubEntryId', 'athleteName'], { unique: true, name: 'tournament_club_player_stats_entry_name_uq' });
    await queryInterface.addIndex('TournamentClubPlayerStats', ['athleteUserId'], { name: 'tournament_club_player_stats_athlete_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('TournamentClubPlayerStats');
    await queryInterface.dropTable('TournamentClubEntries');
  },
};
