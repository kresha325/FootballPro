module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('LiveStreamAnalytics')) {
      await queryInterface.createTable('LiveStreamAnalytics', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        liveStreamId: { type: Sequelize.INTEGER, references: { model: 'LiveStreams', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        timestamp: { type: Sequelize.DATE, allowNull: false },
        concurrentViewers: { type: Sequelize.INTEGER, defaultValue: 0 },
        likes: { type: Sequelize.INTEGER, defaultValue: 0 },
        donations: { type: Sequelize.DECIMAL(10,2), defaultValue: 0 },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('LiveStreamAnalytics');
  },
};
