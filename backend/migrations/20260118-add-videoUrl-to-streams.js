'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('Streams');
    if (!table.videoUrl) {
      await queryInterface.addColumn('Streams', 'videoUrl', {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
        comment: 'URL e videos së regjistruar ose stream-it',
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('Streams');
    if (table.videoUrl) {
      await queryInterface.removeColumn('Streams', 'videoUrl');
    }
  }
};
