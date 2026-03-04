module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('UserRewards')) {
      await queryInterface.createTable('UserRewards', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        userId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        rewardId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Rewards', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        claimedAt: { type: Sequelize.DATE, allowNull: true, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('UserRewards');
  }
};
