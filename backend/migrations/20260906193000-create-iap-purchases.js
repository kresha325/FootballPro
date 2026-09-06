'use strict';

async function tableExists(queryInterface, name) {
  const tables = await queryInterface.showAllTables();
  return tables.map((t) => String(t).toLowerCase()).includes(String(name).toLowerCase());
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (await tableExists(queryInterface, 'IapPurchases')) return;

    await queryInterface.createTable('IapPurchases', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      platform: { type: Sequelize.STRING(16), allowNull: false },
      productId: { type: Sequelize.STRING(128), allowNull: false },
      transactionId: { type: Sequelize.STRING(191), allowNull: false },
      purchaseToken: { type: Sequelize.TEXT, allowNull: true },
      kind: { type: Sequelize.STRING(32), allowNull: false },
      status: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'completed' },
      rawPayload: { type: Sequelize.JSONB, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addIndex('IapPurchases', ['transactionId'], {
      unique: true,
      name: 'iap_purchases_transaction_id_unique',
    });
    await queryInterface.addIndex('IapPurchases', ['userId', 'productId']);
  },

  down: async (queryInterface) => {
    if (await tableExists(queryInterface, 'IapPurchases')) {
      await queryInterface.dropTable('IapPurchases');
    }
  },
};
