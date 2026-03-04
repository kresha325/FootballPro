module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('Payments')) {
      await queryInterface.createTable('Payments', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        userId: { type: Sequelize.INTEGER, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        amount: { type: Sequelize.DECIMAL(10,2), allowNull: true },
        currency: { type: Sequelize.STRING, defaultValue: 'USD' },
        description: { type: Sequelize.STRING, allowNull: true },
        status: { type: Sequelize.ENUM('pending','completed','failed'), defaultValue: 'pending' },
        stripePaymentIntentId: { type: Sequelize.STRING, allowNull: true },
        stripeClientSecret: { type: Sequelize.STRING, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('Payments');
  },
};
