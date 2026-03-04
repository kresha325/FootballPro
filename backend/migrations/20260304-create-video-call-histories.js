module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('VideoCallHistories')) {
      await queryInterface.createTable('VideoCallHistories', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        roomId: { type: Sequelize.STRING, allowNull: false },
        participants: { type: Sequelize.JSONB, allowNull: false },
        startedAt: { type: Sequelize.DATE, allowNull: false },
        endedAt: { type: Sequelize.DATE, allowNull: true },
        status: { type: Sequelize.ENUM('completed','missed','rejected','cancelled'), defaultValue: 'completed' },
      });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('VideoCallHistories');
  },
};
