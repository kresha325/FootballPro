'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const profiles = await queryInterface.describeTable('Profiles');
    if (!profiles.youtubeChannelId) {
      await queryInterface.addColumn('Profiles', 'youtubeChannelId', {
        type: Sequelize.STRING(32),
        allowNull: true,
        comment: 'YouTube channel ID (UC...) për live embed për përdoruesin',
      });
    }
    const streams = await queryInterface.describeTable('Streams');
    if (!streams.youtubeChannelId) {
      await queryInterface.addColumn('Streams', 'youtubeChannelId', {
        type: Sequelize.STRING(32),
        allowNull: true,
        comment: 'YouTube channel ID për këtë sesion live (kopjohet nga profili ose body)',
      });
    }
  },

  down: async (queryInterface) => {
    const profiles = await queryInterface.describeTable('Profiles');
    if (profiles.youtubeChannelId) {
      await queryInterface.removeColumn('Profiles', 'youtubeChannelId');
    }
    const streams = await queryInterface.describeTable('Streams');
    if (streams.youtubeChannelId) {
      await queryInterface.removeColumn('Streams', 'youtubeChannelId');
    }
  },
};
