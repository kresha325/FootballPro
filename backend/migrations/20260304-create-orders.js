module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('Orders')) {
      await queryInterface.createTable('Orders', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        userId: { type: Sequelize.INTEGER, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        products: { type: Sequelize.JSON, allowNull: false },
        totalAmount: { type: Sequelize.DECIMAL(10,2), allowNull: false },
        status: { type: Sequelize.ENUM('pending','paid','shipped','delivered','cancelled'), defaultValue: 'pending' },
        paymentId: { type: Sequelize.INTEGER, references: { model: 'Payments', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('Orders');
  },
};
