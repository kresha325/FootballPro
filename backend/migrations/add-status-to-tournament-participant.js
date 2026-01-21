"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('TournamentParticipants');
    if (!table.status) {
      await queryInterface.addColumn('TournamentParticipants', 'status', {
        type: Sequelize.ENUM('pending', 'accepted', 'rejected'),
        defaultValue: 'pending',
        allowNull: false,
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('TournamentParticipants');
    if (table.status) {
      await queryInterface.removeColumn('TournamentParticipants', 'status');
    }
  },
};
