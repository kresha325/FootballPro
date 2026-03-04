module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('LiveStreamReplays')) {
      await queryInterface.createTable('LiveStreamReplays', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        streamId: { type: Sequelize.INTEGER, allowNull: false },
        userId: { type: Sequelize.INTEGER, allowNull: false },
        videoUrl: { type: Sequelize.STRING, allowNull: false },
        highlight: { type: Sequelize.BOOLEAN, defaultValue: false },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('LiveStreamReplays');
  },
};
