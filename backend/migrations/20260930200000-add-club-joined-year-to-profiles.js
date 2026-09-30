'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const desc = await queryInterface.describeTable('Profiles');
    if (!desc.clubJoinedYear) {
      await queryInterface.addColumn('Profiles', 'clubJoinedYear', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    const desc = await queryInterface.describeTable('Profiles');
    if (desc.clubJoinedYear) {
      await queryInterface.removeColumn('Profiles', 'clubJoinedYear');
    }
  },
};
