'use strict';

async function tableExists(queryInterface, name) {
  const tables = await queryInterface.showAllTables();
  return tables.map((t) => String(t).toLowerCase()).includes(String(name).toLowerCase());
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (await tableExists(queryInterface, 'Invoices')) return;

    await queryInterface.createTable('Invoices', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      invoiceNumber: { type: Sequelize.STRING(32), allowNull: false },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      kind: { type: Sequelize.STRING(32), allowNull: false },
      source: { type: Sequelize.STRING(32), allowNull: false },
      status: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'completed' },
      amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      currency: { type: Sequelize.STRING(8), allowNull: false, defaultValue: 'EUR' },
      description: { type: Sequelize.STRING(255), allowNull: true },
      plan: { type: Sequelize.STRING(32), allowNull: true },
      productId: { type: Sequelize.STRING(128), allowNull: true },
      joncoinAmount: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      externalId: { type: Sequelize.STRING(191), allowNull: true },
      paymentId: { type: Sequelize.INTEGER, allowNull: true },
      iapPurchaseId: { type: Sequelize.INTEGER, allowNull: true },
      joncoinTransactionId: { type: Sequelize.INTEGER, allowNull: true },
      rawPayload: { type: Sequelize.JSONB, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addIndex('Invoices', ['invoiceNumber'], {
      unique: true,
      name: 'invoices_invoice_number_unique',
    });
    await queryInterface.addIndex('Invoices', ['source', 'externalId'], {
      unique: true,
      name: 'invoices_source_external_unique',
    });
    await queryInterface.addIndex('Invoices', ['userId', 'createdAt']);
    await queryInterface.addIndex('Invoices', ['kind', 'source']);
  },

  down: async (queryInterface) => {
    if (await tableExists(queryInterface, 'Invoices')) {
      await queryInterface.dropTable('Invoices');
    }
  },
};
