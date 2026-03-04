module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('Achievements')) {
      await queryInterface.createTable('Achievements', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: Sequelize.STRING, allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: true },
        icon: { type: Sequelize.STRING, allowNull: true },
        points: { type: Sequelize.INTEGER, defaultValue: 0 },
        experience: { type: Sequelize.INTEGER, defaultValue: 0 },
        criteria: { type: Sequelize.JSON, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Achievements');
  }
};
