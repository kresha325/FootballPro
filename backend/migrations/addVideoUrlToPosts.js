module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDescription = await queryInterface.describeTable('Posts');
    if (!tableDescription.videoUrl) {
      await queryInterface.addColumn('Posts', 'videoUrl', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    const tableDescription = await queryInterface.describeTable('Posts');
    if (tableDescription.videoUrl) {
      await queryInterface.removeColumn('Posts', 'videoUrl');
    }
  }
};
