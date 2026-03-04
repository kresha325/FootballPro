module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('LiveStreams')) {
      await queryInterface.createTable('LiveStreams', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        streamId: { type: Sequelize.INTEGER, references: { model: 'Streams', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        platform: { type: Sequelize.STRING, allowNull: true },
        streamUrl: { type: Sequelize.STRING, allowNull: true },
        startedAt: { type: Sequelize.DATE, allowNull: true },
        endedAt: { type: Sequelize.DATE, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('LiveStreams');
  },
};
