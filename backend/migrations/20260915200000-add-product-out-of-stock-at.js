'use strict';

/** Produkte pa stok që nuk restokohen → fshihen pas 48h. */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const hasProducts = tables.some((t) => String(t).toLowerCase() === 'products');
    if (!hasProducts) return;

    const desc = await queryInterface.describeTable('Products');
    if (!desc.outOfStockAt) {
      await queryInterface.addColumn('Products', 'outOfStockAt', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      });
    }

    // Mark existing zero-stock products as out of stock from now (give 48h grace).
    await queryInterface.sequelize.query(`
      UPDATE "Products"
      SET "outOfStockAt" = NOW()
      WHERE ("stock" IS NULL OR "stock" <= 0)
        AND "outOfStockAt" IS NULL
    `);
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const hasProducts = tables.some((t) => String(t).toLowerCase() === 'products');
    if (!hasProducts) return;
    const desc = await queryInterface.describeTable('Products');
    if (desc.outOfStockAt) {
      await queryInterface.removeColumn('Products', 'outOfStockAt');
    }
  },
};
