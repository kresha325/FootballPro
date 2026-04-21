module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const hasProducts = tables.some((t) => String(t).toLowerCase() === 'products');
    if (!hasProducts) return;
    await queryInterface.changeColumn('Products', 'imageUrl', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },
  down: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const hasProducts = tables.some((t) => String(t).toLowerCase() === 'products');
    if (!hasProducts) return;
    await queryInterface.changeColumn('Products', 'imageUrl', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};
