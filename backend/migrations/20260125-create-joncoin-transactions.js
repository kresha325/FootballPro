// Migration for JonCoinTransactions table
'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('JonCoinTransactions', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      userId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      type: { type: Sequelize.ENUM('purchase', 'spend', 'reward', 'commission', 'withdrawal', 'refund'), allowNull: false },
      amount: { type: Sequelize.DECIMAL(12,2), allowNull: false },
      status: { type: Sequelize.ENUM('pending', 'completed', 'rejected'), allowNull: false, defaultValue: 'pending' },
      relatedEntityType: { type: Sequelize.STRING },
      relatedEntityId: { type: Sequelize.INTEGER },
      description: { type: Sequelize.STRING },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('JonCoinTransactions');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_JonCoinTransactions_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_JonCoinTransactions_status";');
  }
};
