module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('Products')) {
      await queryInterface.createTable('Products', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        sellerId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        name: { type: Sequelize.STRING, allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: true },
        price: { type: Sequelize.DECIMAL(10,2), allowNull: false },
        category: { type: Sequelize.ENUM('gear','tickets','merchandise'), allowNull: false },
        imageUrl: { type: Sequelize.STRING, allowNull: true },
        stock: { type: Sequelize.INTEGER, defaultValue: 0 },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Products');
  }
};
