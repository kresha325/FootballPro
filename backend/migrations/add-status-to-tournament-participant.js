"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('TournamentParticipants', 'status', {
      type: Sequelize.ENUM('pending', 'accepted', 'rejected'),
      defaultValue: 'pending',
      allowNull: false,
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('TournamentParticipants', 'status');
  },
};
