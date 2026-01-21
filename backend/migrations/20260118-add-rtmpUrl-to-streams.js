'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('Streams');
    if (!table.rtmpUrl) {
      await queryInterface.addColumn('Streams', 'rtmpUrl', {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
        comment: 'RTMP ingest URL for YouTube/Twitch/other',
      });
    } else {
      console.log('Kolona rtmpUrl ekziston, nuk u shtua përsëri.');
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Streams', 'rtmpUrl');
  }
};
