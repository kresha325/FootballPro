module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      const tableDesc = await queryInterface.describeTable('Profiles');
      if (!tableDesc.liveVideos) {
        await queryInterface.addColumn('Profiles', 'liveVideos', { type: Sequelize.JSON, allowNull: true, defaultValue: [] });
      }
    } catch (err) {
      // If Profiles table doesn't exist yet, skip — original create migration will handle it
      console.warn('Migration add-liveVideos-to-profiles up: ', err && err.message);
    }
  },
  down: async (queryInterface, Sequelize) => {
    try {
      const tableDesc = await queryInterface.describeTable('Profiles');
      if (tableDesc.liveVideos) {
        await queryInterface.removeColumn('Profiles', 'liveVideos');
      }
    } catch (err) {
      console.warn('Migration add-liveVideos-to-profiles down: ', err && err.message);
    }
  }
};
