module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('Subscriptions')) {
      await queryInterface.createTable('Subscriptions', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        subscriberId: { type: Sequelize.INTEGER, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        subscribedToId: { type: Sequelize.INTEGER, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('Subscriptions');
  },
};
