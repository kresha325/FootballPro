module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('LiveStreamGuests')) {
      await queryInterface.createTable('LiveStreamGuests', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        liveStreamId: { type: Sequelize.INTEGER, references: { model: 'LiveStreams', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        userId: { type: Sequelize.INTEGER, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        joinedAt: { type: Sequelize.DATE, allowNull: true },
        leftAt: { type: Sequelize.DATE, allowNull: true },
      });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('LiveStreamGuests');
  },
};
