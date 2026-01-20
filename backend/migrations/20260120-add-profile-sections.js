'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Profiles', 'achievements', {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn('Profiles', 'matches', {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn('Profiles', 'media', {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn('Profiles', 'performanceTrend', {
      type: Sequelize.JSON,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Profiles', 'achievements');
    await queryInterface.removeColumn('Profiles', 'matches');
    await queryInterface.removeColumn('Profiles', 'media');
    await queryInterface.removeColumn('Profiles', 'performanceTrend');
  }
};
