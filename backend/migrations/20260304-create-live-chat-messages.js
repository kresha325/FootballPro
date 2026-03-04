module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('LiveChatMessages')) {
      await queryInterface.createTable('LiveChatMessages', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        liveStreamId: { type: Sequelize.INTEGER, references: { model: 'LiveStreams', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        userId: { type: Sequelize.INTEGER, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        message: { type: Sequelize.TEXT, allowNull: false },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('LiveChatMessages');
  },
};
