'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const desc = await queryInterface.describeTable('Profiles');
    if (!desc['clubId']) {
      await queryInterface.addColumn('Profiles', 'clubId', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const desc = await queryInterface.describeTable('Profiles');
    if (desc['clubId']) {
      await queryInterface.removeColumn('Profiles', 'clubId');
    }
  }
};
