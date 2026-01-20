'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Streams', 'rtmpUrl', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
      comment: 'RTMP ingest URL for YouTube/Twitch/other',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Streams', 'rtmpUrl');
  }
};
