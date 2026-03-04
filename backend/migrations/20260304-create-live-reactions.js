module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('LiveReactions')) {
      await queryInterface.createTable('LiveReactions', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        streamId: { type: Sequelize.INTEGER, allowNull: false },
        userId: { type: Sequelize.INTEGER, allowNull: false },
        emoji: { type: Sequelize.STRING, allowNull: false },
        timestamp: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('LiveReactions');
  },
};
