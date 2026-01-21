'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('Profiles');
    if (!table.achievements) {
      await queryInterface.addColumn('Profiles', 'achievements', {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }
    if (!table.matches) {
      await queryInterface.addColumn('Profiles', 'matches', {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }
    if (!table.media) {
      await queryInterface.addColumn('Profiles', 'media', {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }
    if (!table.performanceTrend) {
      await queryInterface.addColumn('Profiles', 'performanceTrend', {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('Profiles');
    if (table.achievements) {
      await queryInterface.removeColumn('Profiles', 'achievements');
    }
    if (table.matches) {
      await queryInterface.removeColumn('Profiles', 'matches');
    }
    if (table.media) {
      await queryInterface.removeColumn('Profiles', 'media');
    }
    if (table.performanceTrend) {
      await queryInterface.removeColumn('Profiles', 'performanceTrend');
    }
  }
};
