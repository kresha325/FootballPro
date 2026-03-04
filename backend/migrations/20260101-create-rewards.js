module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('Rewards')) {
      await queryInterface.createTable('Rewards', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: Sequelize.STRING, allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: true },
        type: { type: Sequelize.ENUM('points','badge','premium','discount','custom'), allowNull: false },
        value: { type: Sequelize.INTEGER, allowNull: true },
        badgeId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Badges', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Rewards');
  }
};
